class DashboardManager {
  constructor() {
    this.baseURL = 'https://brainquiz-backend.onrender.com';
    this.dados = {
      quizzes: [],
      pdfs: [],
      arquivados: [],
      excluidos: []
    };
  }

  async inicializar() {
    try {
      // Verificar autenticação primeiro
      const usuario = await authManager.getUsuarioAtual();
      if (!usuario) {
        console.error('❌ Usuário não autenticado');
        return;
      }

      console.log('✅ Dashboard iniciando para:', usuario.nome);
      
      this.exibirUsuario(usuario);
      await this.carregarTodosDados();
      this.configurarEventListeners();
      
    } catch (error) {
      console.error('Erro ao inicializar dashboard:', error);
      this.mostrarErro('Erro ao carregar dashboard. Tente recarregar a página.');
    }
  }

  exibirUsuario(usuario) {
    const nomeUsuarioElement = document.getElementById('nomeUsuario');
    const tipoUsuarioElement = document.getElementById('tipoUsuario');
    
    if (nomeUsuarioElement) {
      nomeUsuarioElement.textContent = `${usuario.nome} ${usuario.sobrenome || ''}`.trim();
    }
    
    if (tipoUsuarioElement) {
      tipoUsuarioElement.textContent = usuario.tipo === 'administrador' ? 'Administrador' : 'Usuário';
    }
  }

  async carregarTodosDados() {
    try {
      this.mostrarCarregamento('Carregando dados...');

      // Carregar todos os dados em paralelo com fallback
      const promessas = [
        this.carregarComFallback('/api/quizzes', 'quizzes'),
        this.carregarComFallback('/api/pdfs', 'pdfs'),
        this.carregarComFallback('/api/quizzes/arquivados', 'arquivados'),
        this.carregarComFallback('/api/quizzes/excluidos', 'excluidos')
      ];

      const resultados = await Promise.allSettled(promessas);
      
      resultados.forEach((resultado, index) => {
        if (resultado.status === 'fulfilled') {
          const chaves = ['quizzes', 'pdfs', 'arquivados', 'excluidos'];
          this.dados[chaves[index]] = resultado.value;
        }
      });

      this.renderizarDados();
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.mostrarErro('Erro ao carregar alguns dados. Algumas funcionalidades podem estar limitadas.');
    } finally {
      this.esconderCarregamento();
    }
  }

  async carregarComFallback(endpoint, tipo) {
    try {
      const response = await authManager.makeAuthenticatedRequest(`${this.baseURL}${endpoint}`);
      
      if (response.ok) {
        const data = await response.json();
        return data[tipo] || data.quizzes || data.pdfs || [];
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn(`Falha ao carregar ${tipo}, usando cache local:`, error);
      
      // Tentar carregar do localStorage como fallback
      const cache = localStorage.getItem(`cache_${tipo}`);
      return cache ? JSON.parse(cache) : [];
    }
  }

  renderizarDados() {
    this.renderizarQuizzes();
    this.renderizarPDFs();
    this.renderizarArquivados();
    this.renderizarExcluidos();
    this.atualizarEstatisticas();
  }

  renderizarQuizzes() {
    const container = document.getElementById('quizzes-container');
    if (!container) return;

    if (this.dados.quizzes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📝 Nenhum quiz criado ainda.</p>
          <button class="btn btn-primary" onclick="window.location.href='painel.html'">
            Criar Primeiro Quiz
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <h3>📝 Quizzes Ativos (${this.dados.quizzes.length})</h3>
        <button class="btn btn-success" onclick="window.location.href='painel.html'">
          + Novo Quiz
        </button>
      </div>
      <div class="items-grid">
        ${this.dados.quizzes.map(quiz => this.criarCardQuiz(quiz)).join('')}
      </div>
    `;
  }

  criarCardQuiz(quiz) {
    const titulo = quiz.titulo || quiz.nome || 'Quiz sem título';
    const perguntas = quiz.perguntas ? quiz.perguntas.length : 0;
    const dataModificacao = quiz.modificadoEm || quiz.criadoEm || new Date().toISOString();

    return `
      <div class="item-card quiz-card" data-quiz-id="${quiz.id}">
        <div class="card-header">
          <h4 class="card-title">${titulo}</h4>
          <div class="card-actions">
            <button class="btn-icon" onclick="dashboardManager.jogarQuiz('${quiz.id}')" title="Jogar">
              ▶️
            </button>
            <button class="btn-icon" onclick="dashboardManager.editarQuiz('${quiz.id}')" title="Editar">
              ✏️
            </button>
            <button class="btn-icon" onclick="dashboardManager.arquivarQuiz('${quiz.id}')" title="Arquivar">
              📦
            </button>
            <button class="btn-icon" onclick="dashboardManager.excluirQuiz('${quiz.id}')" title="Excluir">
              🗑️
            </button>
          </div>
        </div>
        <div class="card-body">
          <p class="card-info">📊 ${perguntas} pergunta(s)</p>
          <p class="card-info">📅 ${this.formatarData(dataModificacao)}</p>
        </div>
      </div>
    `;
  }

  renderizarPDFs() {
    const container = document.getElementById('pdfs-container');
    if (!container) return;

    if (this.dados.pdfs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📄 Nenhum PDF carregado ainda.</p>
          <input type="file" id="upload-pdf" accept=".pdf" style="display: none;" onchange="dashboardManager.uploadPDF(this)">
          <button class="btn btn-primary" onclick="document.getElementById('upload-pdf').click()">
            Carregar Primeiro PDF
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="section-header">
        <h3>📄 PDFs Disponíveis (${this.dados.pdfs.length})</h3>
        <input type="file" id="upload-pdf" accept=".pdf" style="display: none;" onchange="dashboardManager.uploadPDF(this)">
        <button class="btn btn-success" onclick="document.getElementById('upload-pdf').click()">
          + Novo PDF
        </button>
      </div>
      <div class="items-grid">
        ${this.dados.pdfs.map(pdf => this.criarCardPDF(pdf)).join('')}
      </div>
    `;
  }

  criarCardPDF(pdf) {
    const nome = pdf.nome || 'PDF sem nome';
    const dataUpload = pdf.dataUpload || pdf.uploadedAt || new Date().toISOString();
    const bloqueado = pdf.bloqueado ? '🔒' : '🔓';

    return `
      <div class="item-card pdf-card" data-pdf-id="${pdf.id}">
        <div class="card-header">
          <h4 class="card-title">${bloqueado} ${nome}</h4>
          <div class="card-actions">
            <button class="btn-icon" onclick="dashboardManager.visualizarPDF('${pdf.id}')" title="Visualizar">
              👁️
            </button>
            <button class="btn-icon" onclick="dashboardManager.baixarPDF('${pdf.id}')" title="Baixar">
              💾
            </button>
            <button class="btn-icon" onclick="dashboardManager.alternarBloqueio('${pdf.id}')" title="${pdf.bloqueado ? 'Desbloquear' : 'Bloquear'}">
              ${pdf.bloqueado ? '🔓' : '🔒'}
            </button>
            <button class="btn-icon" onclick="dashboardManager.excluirPDF('${pdf.id}')" title="Excluir">
              🗑️
            </button>
          </div>
        </div>
        <div class="card-body">
          <p class="card-info">📅 ${this.formatarData(dataUpload)}</p>
          <p class="card-info">👤 ${pdf.uploadedBy || 'Desconhecido'}</p>
        </div>
      </div>
    `;
  }

  atualizarEstatisticas() {
    const stats = {
      totalQuizzes: this.dados.quizzes.length,
      totalPDFs: this.dados.pdfs.length,
      totalArquivados: this.dados.arquivados.length,
      totalExcluidos: this.dados.excluidos.length
    };

    // Atualizar elementos de estatística se existirem
    Object.entries(stats).forEach(([key, value]) => {
      const elemento = document.getElementById(key);
      if (elemento) {
        elemento.textContent = value;
      }
    });
  }

  // AÇÕES DO QUIZ
  async jogarQuiz(quizId) {
    try {
      const quiz = this.dados.quizzes.find(q => q.id === quizId);
      if (!quiz) {
        this.mostrarErro('Quiz não encontrado');
        return;
      }

      // Salvar no localStorage para o quiz.html
      localStorage.setItem('quizAtual', JSON.stringify(quiz));
      
      // Redirecionar para o player
      window.location.href = 'https://brainquiiz.netlify.com/quiz.html';
      
    } catch (error) {
      console.error('Erro ao jogar quiz:', error);
      this.mostrarErro('Erro ao carregar quiz');
    }
  }

  editarQuiz(quizId) {
    // Implementar edição de quiz
    const quiz = this.dados.quizzes.find(q => q.id === quizId);
    if (quiz) {
      localStorage.setItem('quizParaEditar', JSON.stringify(quiz));
      window.location.href = 'https://brainquiiz.netlify.com/painel.html';
    }
  }

  async arquivarQuiz(quizId) {
    if (!confirm('Tem certeza que deseja arquivar este quiz?')) return;

    try {
      const response = await authManager.makeAuthenticatedRequest(`${this.baseURL}/api/quiz/${quizId}/arquivar`, {
        method: 'POST'
      });

      if (response.ok) {
        await this.carregarTodosDados();
        this.mostrarSucesso('Quiz arquivado com sucesso');
      } else {
        throw new Error('Falha ao arquivar');
      }
    } catch (error) {
      console.error('Erro ao arquivar quiz:', error);
      this.mostrarErro('Erro ao arquivar quiz');
    }
  }

  async excluirQuiz(quizId) {
    if (!confirm('Tem certeza que deseja excluir este quiz? Esta a

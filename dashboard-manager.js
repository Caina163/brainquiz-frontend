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
      window.location.href = 'https://brainquiiz.netlify.app/quiz.html';
      
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
      window.location.href = 'https://brainquiiz.netlify.app/painel.html';
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
    if (!confirm('Tem certeza que deseja excluir este quiz? Esta ação não pode ser desfeita.')) return;

    try {
      const response = await authManager.makeAuthenticatedRequest(`${this.baseURL}/api/quiz/${quizId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await this.carregarTodosDados();
        this.mostrarSucesso('Quiz excluído com sucesso');
      } else
throw new Error('Falha ao excluir');
     }
   } catch (error) {
     console.error('Erro ao excluir quiz:', error);
     this.mostrarErro('Erro ao excluir quiz');
   }
 }

 // AÇÕES DO PDF
 visualizarPDF(pdfId) {
   const pdf = this.dados.pdfs.find(p => p.id === pdfId);
   if (!pdf) {
     this.mostrarErro('PDF não encontrado');
     return;
   }

   if (pdf.bloqueado) {
     this.mostrarErro('Este PDF está bloqueado para visualização');
     return;
   }

   // Abrir PDF em nova aba
   const newWindow = window.open();
   newWindow.document.write(`
     <html>
       <head>
         <title>${pdf.nome}</title>
         <style>
           body { margin: 0; padding: 0; }
           iframe { width: 100%; height: 100vh; border: none; }
         </style>
       </head>
       <body>
         <iframe src="${pdf.dados || pdf.base64}"></iframe>
       </body>
     </html>
   `);
 }

 baixarPDF(pdfId) {
   const pdf = this.dados.pdfs.find(p => p.id === pdfId);
   if (!pdf) {
     this.mostrarErro('PDF não encontrado');
     return;
   }

   try {
     const link = document.createElement('a');
     link.href = pdf.dados || pdf.base64;
     link.download = pdf.nome;
     link.click();
     
     this.mostrarSucesso('Download iniciado');
   } catch (error) {
     console.error('Erro ao baixar PDF:', error);
     this.mostrarErro('Erro ao baixar PDF');
   }
 }

 async alternarBloqueio(pdfId) {
   try {
     const pdf = this.dados.pdfs.find(p => p.id === pdfId);
     if (!pdf) {
       this.mostrarErro('PDF não encontrado');
       return;
     }

     const novoBloqueio = !pdf.bloqueado;
     const acao = novoBloqueio ? 'bloquear' : 'desbloquear';
     
     if (!confirm(`Tem certeza que deseja ${acao} este PDF?`)) return;

     const response = await authManager.makeAuthenticatedRequest(`${this.baseURL}/api/pdf/${pdfId}/bloqueio`, {
       method: 'PATCH',
       body: JSON.stringify({ bloqueado: novoBloqueio })
     });

     if (response.ok) {
       pdf.bloqueado = novoBloqueio;
       this.renderizarPDFs();
       this.mostrarSucesso(`PDF ${acao}do com sucesso`);
     } else {
       throw new Error(`Falha ao ${acao}`);
     }
   } catch (error) {
     console.error('Erro ao alterar bloqueio:', error);
     this.mostrarErro('Erro ao alterar status do PDF');
   }
 }

 async excluirPDF(pdfId) {
   if (!confirm('Tem certeza que deseja excluir este PDF? Esta ação não pode ser desfeita.')) return;

   try {
     const response = await authManager.makeAuthenticatedRequest(`${this.baseURL}/api/pdf/${pdfId}`, {
       method: 'DELETE'
     });

     if (response.ok) {
       await this.carregarTodosDados();
       this.mostrarSucesso('PDF excluído com sucesso');
     } else {
       throw new Error('Falha ao excluir');
     }
   } catch (error) {
     console.error('Erro ao excluir PDF:', error);
     this.mostrarErro('Erro ao excluir PDF');
   }
 }

 async uploadPDF(input) {
   const file = input.files[0];
   if (!file) return;

   if (file.type !== 'application/pdf') {
     this.mostrarErro('Apenas arquivos PDF são permitidos');
     return;
   }

   if (file.size > 10 * 1024 * 1024) { // 10MB
     this.mostrarErro('Arquivo muito grande. Máximo 10MB permitido');
     return;
   }

   try {
     this.mostrarCarregamento('Enviando PDF...');

     const formData = new FormData();
     formData.append('pdf', file);

     const response = await authManager.makeAuthenticatedRequest(`${this.baseURL}/upload-pdf`, {
       method: 'POST',
       body: formData,
       headers: {} // Remover Content-Type para FormData
     });

     if (response.ok) {
       await this.carregarTodosDados();
       this.mostrarSucesso('PDF enviado com sucesso');
       input.value = ''; // Limpar input
     } else {
       const data = await response.json();
       throw new Error(data.message || 'Falha no upload');
     }
   } catch (error) {
     console.error('Erro no upload:', error);
     this.mostrarErro(`Erro ao enviar PDF: ${error.message}`);
   } finally {
     this.esconderCarregamento();
   }
 }

 renderizarArquivados() {
   const container = document.getElementById('arquivados-container');
   if (!container) return;

   if (this.dados.arquivados.length === 0) {
     container.innerHTML = `
       <div class="empty-state">
         <p>📦 Nenhum quiz arquivado.</p>
       </div>
     `;
     return;
   }

   container.innerHTML = `
     <div class="section-header">
       <h3>📦 Quizzes Arquivados (${this.dados.arquivados.length})</h3>
     </div>
     <div class="items-grid">
       ${this.dados.arquivados.map(quiz => this.criarCardArquivado(quiz)).join('')}
     </div>
   `;
 }

 criarCardArquivado(quiz) {
   const titulo = quiz.titulo || quiz.nome || 'Quiz sem título';
   const dataArquivamento = quiz.arquivadoEm || new Date().toISOString();

   return `
     <div class="item-card archived-card" data-quiz-id="${quiz.id}">
       <div class="card-header">
         <h4 class="card-title">📦 ${titulo}</h4>
         <div class="card-actions">
           <button class="btn-icon" onclick="dashboardManager.restaurarQuiz('${quiz.id}')" title="Restaurar">
             🔄
           </button>
           <button class="btn-icon" onclick="dashboardManager.excluirDefinitivamente('${quiz.id}')" title="Excluir Definitivamente">
             🗑️
           </button>
         </div>
       </div>
       <div class="card-body">
         <p class="card-info">📅 Arquivado em ${this.formatarData(dataArquivamento)}</p>
       </div>
     </div>
   `;
 }

 renderizarExcluidos() {
   const container = document.getElementById('excluidos-container');
   if (!container) return;

   if (this.dados.excluidos.length === 0) {
     container.innerHTML = `
       <div class="empty-state">
         <p>🗑️ Lixeira vazia.</p>
       </div>
     `;
     return;
   }

   container.innerHTML = `
     <div class="section-header">
       <h3>🗑️ Quizzes Excluídos (${this.dados.excluidos.length})</h3>
       <button class="btn btn-danger" onclick="dashboardManager.limparLixeira()">
         Esvaziar Lixeira
       </button>
     </div>
     <div class="items-grid">
       ${this.dados.excluidos.map(quiz => this.criarCardExcluido(quiz)).join('')}
     </div>
   `;
 }

 criarCardExcluido(quiz) {
   const titulo = quiz.titulo || quiz.nome || 'Quiz sem título';
   const dataExclusao = quiz.excluidoEm || new Date().toISOString();

   return `
     <div class="item-card deleted-card" data-quiz-id="${quiz.id}">
       <div class="card-header">
         <h4 class="card-title">🗑️ ${titulo}</h4>
         <div class="card-actions">
           <button class="btn-icon" onclick="dashboardManager.restaurarExcluido('${quiz.id}')" title="Restaurar">
             🔄
           </button>
         </div>
       </div>
       <div class="card-body">
         <p class="card-info">📅 Excluído em ${this.formatarData(dataExclusao)}</p>
       </div>
     </div>
   `;
 }

 async restaurarQuiz(quizId) {
   if (!confirm('Deseja restaurar este quiz?')) return;

   try {
     const response = await authManager.makeAuthenticatedRequest(`${this.baseURL}/api/quiz/${quizId}/restaurar`, {
       method: 'POST'
     });

     if (response.ok) {
       await this.carregarTodosDados();
       this.mostrarSucesso('Quiz restaurado com sucesso');
     } else {
       throw new Error('Falha ao restaurar');
     }
   } catch (error) {
     console.error('Erro ao restaurar quiz:', error);
     this.mostrarErro('Erro ao restaurar quiz');
   }
 }

 async excluirDefinitivamente(quizId) {
   if (!confirm('ATENÇÃO: Esta ação irá excluir o quiz permanentemente. Tem certeza?')) return;

   try {
     const response = await authManager.makeAuthenticatedRequest(`${this.baseURL}/api/quiz/${quizId}/definitivo`, {
       method: 'DELETE'
     });

     if (response.ok) {
       await this.carregarTodosDados();
       this.mostrarSucesso('Quiz excluído definitivamente');
     } else {
       throw new Error('Falha ao excluir definitivamente');
     }
   } catch (error) {
     console.error('Erro ao excluir definitivamente:', error);
     this.mostrarErro('Erro ao excluir quiz definitivamente');
   }
 }

 async limparLixeira() {
   if (!confirm('ATENÇÃO: Esta ação irá excluir TODOS os quizzes da lixeira permanentemente. Tem certeza?')) return;

   try {
     const response = await authManager.makeAuthenticatedRequest(`${this.baseURL}/api/quizzes/limpar-lixeira`, {
       method: 'DELETE'
     });

     if (response.ok) {
       await this.carregarTodosDados();
       this.mostrarSucesso('Lixeira esvaziada com sucesso');
     } else {
       throw new Error('Falha ao limpar lixeira');
     }
   } catch (error) {
     console.error('Erro ao limpar lixeira:', error);
     this.mostrarErro('Erro ao esvaziar lixeira');
   }
 }

 configurarEventListeners() {
   // Configurar busca
   const campoBusca = document.getElementById('campo-busca');
   if (campoBusca) {
     campoBusca.addEventListener('input', (e) => {
       this.filtrarItens(e.target.value);
     });
   }

   // Configurar filtros de categoria
   const filtroCategoria = document.getElementById('filtro-categoria');
   if (filtroCategoria) {
     filtroCategoria.addEventListener('change', (e) => {
       this.filtrarPorCategoria(e.target.value);
     });
   }

   // Configurar botão de logout
   const btnLogout = document.getElementById('btn-logout');
   if (btnLogout) {
     btnLogout.addEventListener('click', () => {
       if (confirm('Tem certeza que deseja sair?')) {
         authManager.logout();
       }
     });
   }

   // Configurar refresh automático
   setInterval(() => {
     this.carregarTodosDados();
   }, 5 * 60 * 1000); // Refresh a cada 5 minutos
 }

 filtrarItens(termo) {
   const cards = document.querySelectorAll('.item-card');
   termo = termo.toLowerCase();

   cards.forEach(card => {
     const titulo = card.querySelector('.card-title').textContent.toLowerCase();
     const matches = titulo.includes(termo);
     card.style.display = matches ? 'block' : 'none';
   });
 }

 filtrarPorCategoria(categoria) {
   const sections = {
     'todos': ['quizzes-container', 'pdfs-container', 'arquivados-container', 'excluidos-container'],
     'quizzes': ['quizzes-container'],
     'pdfs': ['pdfs-container'],
     'arquivados': ['arquivados-container'],
     'excluidos': ['excluidos-container']
   };

   // Esconder todas as seções
   Object.values(sections).flat().forEach(id => {
     const elemento = document.getElementById(id);
     if (elemento) elemento.style.display = 'none';
   });

   // Mostrar seções relevantes
   if (sections[categoria]) {
     sections[categoria].forEach(id => {
       const elemento = document.getElementById(id);
       if (elemento) elemento.style.display = 'block';
     });
   }
 }

 formatarData(isoString) {
   try {
     const data = new Date(isoString);
     return data.toLocaleDateString('pt-BR', {
       day: '2-digit',
       month: '2-digit',
       year: 'numeric',
       hour: '2-digit',
       minute: '2-digit'
     });
   } catch (error) {
     return 'Data inválida';
   }
 }

 mostrarCarregamento(mensagem = 'Carregando...') {
   const loader = document.getElementById('dashboard-loader') || document.createElement('div');
   loader.id = 'dashboard-loader';
   loader.innerHTML = `
     <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                 background: rgba(0,0,0,0.3); display: flex; align-items: center; 
                 justify-content: center; z-index: 9999;">
       <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
         <div style="border: 3px solid #f3f3f3; border-top: 3px solid #3498db; 
                     border-radius: 50%; width: 30px; height: 30px; 
                     animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
         <p>${mensagem}</p>
       </div>
     </div>
   `;
   
   if (!document.getElementById('dashboard-loader')) {
     document.body.appendChild(loader);
   }
 }

 esconderCarregamento() {
   const loader = document.getElementById('dashboard-loader');
   if (loader) {
     loader.remove();
   }
 }

 mostrarSucesso(mensagem) {
   this.mostrarNotificacao(mensagem, 'success');
 }

 mostrarErro(mensagem) {
   this.mostrarNotificacao(mensagem, 'error');
 }

 mostrarNotificacao(mensagem, tipo = 'info') {
   const cores = {
     success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
     error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
     info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' }
   };

   const cor = cores[tipo] || cores.info;

   const notification = document.createElement('div');
   notification.style.cssText = `
     position: fixed;
     top: 20px;
     right: 20px;
     z-index: 10000;
     padding: 15px 20px;
     background: ${cor.bg};
     color: ${cor.text};
     border: 1px solid ${cor.border};
     border-radius: 5px;
     box-shadow: 0 2px 10px rgba(0,0,0,0.1);
     max-width: 400px;
     opacity: 0;
     transform: translateX(100%);
     transition: all 0.3s ease;
   `;

   notification.innerHTML = `
     <div style="display: flex; align-items: center; justify-content: space-between;">
       <span>${mensagem}</span>
       <button onclick="this.parentElement.parentElement.remove()" style="
         background: none; border: none; font-size: 18px; cursor: pointer;
         color: ${cor.text}; margin-left: 10px; padding: 0; line-height: 1;">×</button>
     </div>
   `;

   document.body.appendChild(notification);

   // Animar entrada
   setTimeout(() => {
     notification.style.opacity = '1';
     notification.style.transform = 'translateX(0)';
   }, 10);

   // Auto-remover após 5 segundos
   setTimeout(() => {
     if (notification.parentElement) {
       notification.style.opacity = '0';
       notification.style.transform = 'translateX(100%)';
       setTimeout(() => notification.remove(), 300);
     }
   }, 5000);
 }
}

// Instância global
window.dashboardManager = new DashboardManager();

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
 if (window.location.pathname.includes('dashboard.html')) {
   dashboardManager.inicializar();
 }
});

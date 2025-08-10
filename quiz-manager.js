class QuizManager {
  constructor() {
    this.quiz = null;
    this.perguntaAtual = 0;
    this.respostas = [];
    this.alternativasOriginais = []; // Para armazenar ordem original
    this.alternativasRandomizadas = []; // Para armazenar ordem randomizada
    this.baseURL = 'https://brainquiz-backend.onrender.com';
    this.feedbackMostrado = false;
  }

  async carregarQuiz() {
    try {
      console.log('🔄 Iniciando carregamento do quiz...');
      
      // MÉTODO 1: Verificar URL params
      const urlParams = new URLSearchParams(window.location.search);
      const quizId = urlParams.get('id');
      
      if (quizId) {
        console.log('📋 Tentando carregar quiz por ID:', quizId);
        const quiz = await this.carregarQuizPorId(quizId);
        if (quiz && this.validarEstrutura(quiz)) {
          this.quiz = quiz;
          return this.iniciarQuiz();
        }
      }

      // MÉTODO 2: Verificar dados do backend atual
      console.log('📋 Tentando carregar quiz do backend atual');
      const quizAtual = await this.carregarQuizAtual();
      if (quizAtual && this.validarEstrutura(quizAtual)) {
        this.quiz = this.normalizarQuiz(quizAtual);
        return this.iniciarQuiz();
      }

      // MÉTODO 3: Verificar quiz temporário no servidor
      console.log('📋 Tentando carregar quiz temporário do servidor');
      const quizTemp = await this.carregarQuizTemporario();
      if (quizTemp && this.validarEstrutura(quizTemp)) {
        this.quiz = this.normalizarQuiz(quizTemp);
        return this.iniciarQuiz();
      }

      // Se chegou aqui, nenhum quiz foi encontrado
      this.mostrarErro('❌ Nenhum quiz encontrado. Redirecionando para o dashboard...');
      setTimeout(() => {
        window.location.href = 'https://brainquiiz.netlify.app/dashboard.html';
      }, 3000);

    } catch (error) {
      console.error('❌ Erro crítico ao carregar quiz:', error);
      this.mostrarErro('❌ Erro ao carregar quiz. Tente novamente.');
    }
  }

  async carregarQuizPorId(id) {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `${this.baseURL}/api/quiz/${id}`
      );

      if (response.ok) {
        const data = await response.json();
        return data.quiz;
      }
    } catch (error) {
      console.error('Erro ao carregar quiz por ID:', error);
    }
    return null;
  }

  async carregarQuizAtual() {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `${this.baseURL}/api/quiz-atual`
      );

      if (response.ok) {
        const data = await response.json();
        return data.quiz;
      }
    } catch (error) {
      console.error('Erro ao carregar quiz atual:', error);
    }
    return null;
  }

  async carregarQuizTemporario() {
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `${this.baseURL}/api/quiz-temp`
      );

      if (response.ok) {
        const data = await response.json();
        return data.quiz;
      }
    } catch (error) {
      console.error('Erro ao carregar quiz temporário:', error);
    }
    return null;
  }

  validarEstrutura(quiz) {
    if (!quiz || !quiz.perguntas || !Array.isArray(quiz.perguntas)) {
      console.error('❌ Quiz inválido: estrutura básica incorreta');
      return false;
    }

    if (quiz.perguntas.length === 0) {
      console.error('❌ Quiz inválido: sem perguntas');
      return false;
    }

    const perguntasValidas = quiz.perguntas.every((pergunta, index) => {
      // Verificar se tem texto da pergunta
      if (!pergunta.pergunta && !pergunta.texto) {
        console.error(`❌ Pergunta ${index + 1}: sem texto`);
        return false;
      }

      // Verificar alternativas
      const alternativas = pergunta.alternativas || pergunta.opcoes || [];
      if (!Array.isArray(alternativas) || alternativas.length < 2) {
        console.error(`❌ Pergunta ${index + 1}: alternativas insuficientes`);
        return false;
      }

      // Verificar resposta correta
      const respostaCorreta = pergunta.respostaCorreta !== undefined 
        ? pergunta.respostaCorreta 
        : pergunta.resposta_certa;
      
      if (respostaCorreta === undefined || respostaCorreta < 0 || respostaCorreta >= alternativas.length) {
        console.error(`❌ Pergunta ${index + 1}: resposta correta inválida`);
        return false;
      }

      return true;
    });

    return perguntasValidas;
  }

  normalizarQuiz(quiz) {
    // Normalizar título
    quiz.titulo = quiz.titulo || quiz.nome || 'Quiz sem título';

    // Normalizar perguntas e randomizar alternativas
    quiz.perguntas = quiz.perguntas.map((pergunta, index) => {
      const perguntaNormalizada = {
        id: pergunta.id || `pergunta_${index}`,
        pergunta: pergunta.pergunta || pergunta.texto || '',
        alternativas: pergunta.alternativas || pergunta.opcoes || [],
        respostaCorreta: pergunta.respostaCorreta !== undefined 
          ? pergunta.respostaCorreta 
          : pergunta.resposta_certa,
        explicacao: pergunta.explicacao || '',
        tempo: pergunta.tempo || 30
      };

      // Armazenar alternativas originais
      this.alternativasOriginais[index] = [...perguntaNormalizada.alternativas];
      
      // Randomizar alternativas
      const alternativasComIndice = perguntaNormalizada.alternativas.map((alt, i) => ({
        texto: alt,
        indiceOriginal: i
      }));

      // Shuffle array
      for (let i = alternativasComIndice.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [alternativasComIndice[i], alternativasComIndice[j]] = [alternativasComIndice[j], alternativasComIndice[i]];
      }

      // Armazenar mapeamento
      this.alternativasRandomizadas[index] = alternativasComIndice;
      
      // Atualizar pergunta com alternativas randomizadas
      perguntaNormalizada.alternativas = alternativasComIndice.map(alt => alt.texto);
      
      // Atualizar índice da resposta correta
      const novoIndiceResposta = alternativasComIndice.findIndex(
        alt => alt.indiceOriginal === perguntaNormalizada.respostaCorreta
      );
      perguntaNormalizada.respostaCorreta = novoIndiceResposta;

      return perguntaNormalizada;
    });

    return quiz;
  }

  iniciarQuiz() {
    if (!this.quiz) {
      this.mostrarErro('❌ Dados do quiz inválidos');
      return;
    }

    console.log('✅ Quiz carregado com sucesso:', this.quiz.titulo);
    console.log(`📊 ${this.quiz.perguntas.length} perguntas encontradas`);

    // Resetar estado
    this.perguntaAtual = 0;
    this.respostas = [];
    this.feedbackMostrado = false;

    // Renderizar interface do quiz
    this.renderizarQuiz();
    this.mostrarPerguntaAtual();
  }

  renderizarQuiz() {
    const container = document.getElementById('quiz-container') || document.body;
    
    container.innerHTML = `
      <button class="voltar-inicio-btn" onclick="quizManager.sairQuiz()">
        🏠 Voltar ao Dashboard
      </button>

      <div class="quiz-header">
        <div class="pergunta-numero">Pergunta ${this.perguntaAtual + 1} de ${this.quiz.perguntas.length}</div>
        <h1 class="quiz-titulo">${this.quiz.titulo}</h1>
        <div class="quiz-progresso">
          <div class="progresso-barra">
            <div class="progresso-preenchido" id="barra-progresso"></div>
          </div>
          <span class="progresso-texto" id="progresso-texto">${this.perguntaAtual + 1} de ${this.quiz.perguntas.length}</span>
        </div>
      </div>

      <div class="quiz-content">
        <div class="pergunta-container" id="pergunta-container">
          <!-- Pergunta será inserida aqui -->
        </div>

        <div class="quiz-controls">
          <button id="btn-anterior" class="btn btn-secondary" onclick="quizManager.perguntaAnterior()" disabled>
            ← Anterior
          </button>
          <button id="btn-proximo" class="btn btn-primary" onclick="quizManager.proximaPergunta()" disabled>
            Próxima →
          </button>
          <button id="btn-finalizar" class="btn btn-success" onclick="quizManager.finalizarQuiz()" style="display: none;">
            🏁 Finalizar Quiz
          </button>
        </div>
      </div>

      <div class="quiz-footer">
        <button class="btn-outline-danger" onclick="quizManager.sairQuiz()">
          🚪 Sair do Quiz
        </button>
      </div>
    `;
  }

  mostrarPerguntaAtual() {
    const pergunta = this.quiz.perguntas[this.perguntaAtual];
    const container = document.getElementById('pergunta-container');

    if (!container || !pergunta) return;

    // Reset feedback
    this.feedbackMostrado = false;

    container.innerHTML = `
      <div class="pergunta-card">
        <h3 class="pergunta-titulo">${pergunta.pergunta}</h3>
        
        <div class="alternativas-container">
          ${pergunta.alternativas.map((alternativa, index) => `
            <div class="alternativa-item" onclick="quizManager.selecionarResposta(${index})" data-index="${index}">
              <input type="radio" name="resposta" value="${index}" style="display: none;"
                     ${this.respostas[this.perguntaAtual] === index ? 'checked' : ''}>
              <span class="alternativa-texto">${alternativa}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Atualizar seleção se já existe
    if (this.respostas[this.perguntaAtual] !== undefined) {
      this.marcarAlternativaSelecionada(this.respostas[this.perguntaAtual]);
    }

    this.atualizarInterface();
  }

  selecionarResposta(index) {
    if (this.feedbackMostrado) return; // Impedir mudança após feedback

    // Limpar seleções anteriores
    document.querySelectorAll('.alternativa-item').forEach(item => {
      item.classList.remove('selected');
    });

    // Marcar nova seleção
    this.marcarAlternativaSelecionada(index);
    
    // Salvar resposta
    this.respostas[this.perguntaAtual] = index;

    // Mostrar feedback visual imediato
    this.mostrarFeedbackVisual(index);
    
    this.atualizarInterface();
  }

  marcarAlternativaSelecionada(index) {
    const alternativa = document.querySelector(`[data-index="${index}"]`);
    if (alternativa) {
      alternativa.classList.add('selected');
      const radio = alternativa.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    }
  }

  mostrarFeedbackVisual(respostaSelecionada) {
    const pergunta = this.quiz.perguntas[this.perguntaAtual];
    const respostaCorreta = pergunta.respostaCorreta;
    
    // Marcar feedback depois de um pequeno delay para o usuário ver a seleção
    setTimeout(() => {
      document.querySelectorAll('.alternativa-item').forEach((item, index) => {
        if (index === respostaCorreta) {
          item.classList.add('correct');
        } else if (index === respostaSelecionada && index !== respostaCorreta) {
          item.classList.add('wrong');
        }
      });
      
      this.feedbackMostrado = true;
      
      // Auto-avançar após feedback (opcional)
      if (this.perguntaAtual < this.quiz.perguntas.length - 1) {
        setTimeout(() => {
          this.proximaPergunta();
        }, 2000);
      }
    }, 500);
  }

  proximaPergunta() {
    if (this.perguntaAtual < this.quiz.perguntas.length - 1) {
      this.perguntaAtual++;
      this.mostrarPerguntaAtual();
    }
  }

  perguntaAnterior() {
    if (this.perguntaAtual > 0) {
      this.perguntaAtual--;
      this.mostrarPerguntaAtual();
    }
  }

  atualizarInterface() {
    // Atualizar barra de progresso
    const progresso = ((this.perguntaAtual + 1) / this.quiz.perguntas.length) * 100;
    const barraProgresso = document.getElementById('barra-progresso');
    const textoProgresso = document.getElementById('progresso-texto');
    
    if (barraProgresso) barraProgresso.style.width = `${progresso}%`;
    if (textoProgresso) textoProgresso.textContent = `${this.perguntaAtual + 1} de ${this.quiz.perguntas.length}`;

    // Atualizar número da pergunta no header
    const perguntaNumero = document.querySelector('.pergunta-numero');
    if (perguntaNumero) {
      perguntaNumero.textContent = `Pergunta ${this.perguntaAtual + 1} de ${this.quiz.perguntas.length}`;
    }

    // Atualizar botões
    const btnAnterior = document.getElementById('btn-anterior');
    const btnProximo = document.getElementById('btn-proximo');
    const btnFinalizar = document.getElementById('btn-finalizar');

    if (btnAnterior) btnAnterior.disabled = this.perguntaAtual === 0;
    
    const respostaAtualSelecionada = this.respostas[this.perguntaAtual] !== undefined;
    
    if (this.perguntaAtual === this.quiz.perguntas.length - 1) {
      // Última pergunta
      if (btnProximo) btnProximo.style.display = 'none';
      if (btnFinalizar) {
        btnFinalizar.style.display = 'inline-block';
        btnFinalizar.disabled = !respostaAtualSelecionada;
      }
    } else {
      // Pergunta intermediária
      if (btnProximo) {
        btnProximo.style.display = 'inline-block';
        btnProximo.disabled = !respostaAtualSelecionada;
      }
      if (btnFinalizar) btnFinalizar.style.display = 'none';
    }
  }

  finalizarQuiz() {
    // Verificar se todas as perguntas foram respondidas
    const perguntasNaoRespondidas = [];
    for (let i = 0; i < this.quiz.perguntas.length; i++) {
      if (this.respostas[i] === undefined) {
        perguntasNaoRespondidas.push(i + 1);
      }
    }

    if (perguntasNaoRespondidas.length > 0) {
      const confirmar = confirm(
        `Você não respondeu ${perguntasNaoRespondidas.length} pergunta(s): ${perguntasNaoRespondidas.join(', ')}.\n\nDeseja finalizar mesmo assim?`
      );
      if (!confirmar) return;
    }

    this.calcularResultado();
  }

  calcularResultado() {
    let acertos = 0;
    let detalhes = [];

    this.quiz.perguntas.forEach((pergunta, index) => {
      const respostaUsuario = this.respostas[index];
      const respostaCorreta = pergunta.respostaCorreta;
      const acertou = respostaUsuario === respostaCorreta;

      if (acertou) acertos++;

      // Usar alternativas originais para mostrar no resultado
      const alternativasOriginais = this.alternativasOriginais[index];
      const mapeamento = this.alternativasRandomizadas[index];

      detalhes.push({
        pergunta: pergunta.pergunta,
        respostaUsuario: respostaUsuario !== undefined ? pergunta.alternativas[respostaUsuario] : 'Não respondida',
        respostaCorreta: pergunta.alternativas[respostaCorreta],
        acertou,
        explicacao: pergunta.explicacao || ''
      });
    });

    const porcentagem = Math.round((acertos / this.quiz.perguntas.length) * 100);

    this.mostrarResultado(acertos, this.quiz.perguntas.length, porcentagem, detalhes);
  }

  mostrarResultado(acertos, total, porcentagem, detalhes) {
    const container = document.getElementById('quiz-container') || document.body;

    let nivelDesempenho = '';
    let corNivel = '';
    if (porcentagem >= 80) {
      nivelDesempenho = 'Excelente! 🏆';
      corNivel = '#22c55e';
    } else if (porcentagem >= 60) {
      nivelDesempenho = 'Bom trabalho! 👍';
      corNivel = '#fbbf24';
    } else {
      nivelDesempenho = 'Continue estudando! 📚';
      corNivel = '#ef4444';
    }

    container.innerHTML = `
      <div class="resultado-container">
        <div class="resultado-header">
          <h1>🎉 Quiz Finalizado!</h1>
          <div class="resultado-score" style="color: ${corNivel}">
            <div class="score-circle">
              <span class="score-numero">${porcentagem}%</span>
            </div>
            <h2>${nivelDesempenho}</h2>
            <p>Você acertou ${acertos} de ${total} perguntas</p>
          </div>
        </div>

        <div class="resultado-detalhes">
          <h3 style="color: #0af; margin-bottom: 20px;">📊 Detalhes das Respostas:</h3>
          ${detalhes.map((detalhe, index) => `
            <div class="pergunta-resultado ${detalhe.acertou ? 'acerto' : 'erro'}">
              <h4>Pergunta ${index + 1}: ${detalhe.acertou ? '✅' : '❌'}</h4>
              <p class="pergunta-texto">${detalhe.pergunta}</p>
              <p><strong>Sua resposta:</strong> ${detalhe.respostaUsuario}</p>
              <p><strong>Resposta correta:</strong> ${detalhe.respostaCorreta}</p>
              ${detalhe.explicacao ? `<p class="explicacao"><strong>💡 Explicação:</strong> ${detalhe.explicacao}</p>` : ''}
            </div>
          `).join('')}
        </div>

        <div class="resultado-acoes">
          <button class="btn btn-primary" onclick="quizManager.refazerQuiz()">
            🔄 Refazer Quiz
          </button>
          <button class="btn btn-secondary" onclick="quizManager.voltarDashboard()">
            🏠 Voltar ao Dashboard
          </button>
        </div>
      </div>
    `;

    // Salvar resultado no backend
    this.salvarResultado(acertos, total, porcentagem);
  }

  async salvarResultado(acertos, total, porcentagem) {
    try {
      const resultado = {
        quizId: this.quiz.id,
        quizTitulo: this.quiz.titulo,
        acertos,
        total,
        porcentagem,
        data: new Date().toISOString(),
        detalhes: this.respostas
      };

      // Salvar no backend
      await authManager.makeAuthenticatedRequest(`${this.baseURL}/api/resultado`, {
        method: 'POST',
        body: JSON.stringify(resultado)
      });

      console.log('✅ Resultado salvo no backend');

    } catch (error) {
      console.error('❌ Erro ao salvar resultado no backend:', error);
    }
  }

  refazerQuiz() {
    // Randomizar novamente as alternativas
    this.quiz = this.normalizarQuiz(this.quiz);
    this.perguntaAtual = 0;
    this.respostas = [];
    this.feedbackMostrado = false;
    this.renderizarQuiz();
    this.mostrarPerguntaAtual();
  }

  voltarDashboard() {
    window.location.href = 'https://brainquiiz.netlify.app/dashboard.html';
  }

  sairQuiz() {
    const confirmar = confirm('Tem certeza que deseja sair? Seu progresso será perdido.');
    if (confirmar) {
      this.voltarDashboard();
    }
  }

  mostrarErro(mensagem) {
    const container = document.getElementById('quiz-container') || document.body;
    container.innerHTML = `
      <div class="error-message">
        ${mensagem}
      </div>
    `;

    console.error(mensagem);
  }
}

// Instância global
window.quizManager = new QuizManager();

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('quiz.html')) {
    quizManager.carregarQuiz();
  }
});

console.log('✅ QuizManager com randomização e feedback visual carregado!');

class AuthManager {
  constructor() {
    this.baseURL = 'https://brainquiz-backend.onrender.com';
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.offlineTimeout = 300000; // 5 minutos offline
  }

  async verificarAutenticacao() {
    // Primeira verificação: dados locais
    const token = localStorage.getItem('authToken');
    const usuarioLocal = localStorage.getItem('usuarioLogado');
    const timestamp = localStorage.getItem('authTimestamp');
    
    if (token && usuarioLocal && timestamp) {
      try {
        // Tentar validar no servidor
        const isValid = await this.validarTokenComRetry(token);
        if (isValid) {
          this.atualizarTimestamp();
          return JSON.parse(usuarioLocal);
        }
      } catch (error) {
        console.warn('Erro ao validar token online, usando cache offline:', error);
        
        // Se falhou conexão mas dados são recentes, usar offline
        if (Date.now() - parseInt(timestamp) < this.offlineTimeout) {
          console.log('🔄 Usando autenticação offline (cache válido)');
          return JSON.parse(usuarioLocal);
        }
      }
    }
    
    return null;
  }

  async validarTokenComRetry(token, tentativa = 1) {
    try {
      const response = await fetch(`${this.baseURL}/usuario`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        timeout: 10000 // 10 segundos timeout
      });

      if (response.ok) {
        const data = await response.json();
        return data.success && data.usuario;
      }
      
      if (response.status === 401 || response.status === 403) {
        this.logout();
        return false;
      }
      
      throw new Error(`HTTP ${response.status}`);
      
    } catch (error) {
      if (tentativa < this.maxRetries) {
        await this.delay(this.retryDelay * tentativa);
        return this.validarTokenComRetry(token, tentativa + 1);
      }
      throw error;
    }
  }

  async login(usuario, senha) {
    try {
      this.mostrarCarregamento('Fazendo login...');
      
      const response = await fetch(`${this.baseURL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ usuario, senha })
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Salvar dados de autenticação
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('usuarioLogado', JSON.stringify(data.usuario));
        this.atualizarTimestamp();
        
        console.log('✅ Login realizado com sucesso');
        return { success: true, usuario: data.usuario };
      } else {
        return { success: false, message: data.message || 'Erro no login' };
      }
      
    } catch (error) {
      console.error('Erro no login:', error);
      return { 
        success: false, 
        message: 'Erro de conexão. Verifique sua internet e tente novamente.' 
      };
    } finally {
      this.esconderCarregamento();
    }
  }

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('authTimestamp');
    
    // Redirecionar para página inicial (que é o login)
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      window.location.href = 'https://brainquiiz.netlify.com/';
    }
  }

  atualizarTimestamp() {
    localStorage.setItem('authTimestamp', Date.now().toString());
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  mostrarCarregamento(mensagem) {
    // Criar indicador de carregamento
    const loader = document.createElement('div');
    loader.id = 'auth-loader';
    loader.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                  background: rgba(0,0,0,0.5); display: flex; align-items: center; 
                  justify-content: center; z-index: 9999;">
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="border: 3px solid #f3f3f3; border-top: 3px solid #3498db; 
                      border-radius: 50%; width: 30px; height: 30px; 
                      animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
          <p>${mensagem}</p>
        </div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(loader);
  }

  esconderCarregamento() {
    const loader = document.getElementById('auth-loader');
    if (loader) {
      loader.remove();
    }
  }

  // Verificar se usuário está logado (para uso nos outros arquivos)
  async isLoggedIn() {
    const usuario = await this.verificarAutenticacao();
    return usuario !== null;
  }

  // Obter dados do usuário atual
  async getUsuarioAtual() {
    return await this.verificarAutenticacao();
  }

  // Fazer requisições autenticadas
  async makeAuthenticatedRequest(url, options = {}) {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('Token não encontrado');
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include'
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (response.status === 401 || response.status === 403) {
      this.logout();
      throw new Error('Sessão expirada');
    }

    return response;
  }
}

// Instância global
window.authManager = new AuthManager();

// Verificação automática ao carregar qualquer página (exceto login)
document.addEventListener('DOMContentLoaded', async () => {
  // Só verificar se NÃO está na página de login (index.html)
  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    const loggedIn = await authManager.isLoggedIn();
    
    if (!loggedIn) {
      console.log('❌ Usuário não autenticado, redirecionando para login');
      window.location.href = 'https://brainquiiz.netlify.com/';
    } else {
      console.log('✅ Usuário autenticado');
    }
  }
});

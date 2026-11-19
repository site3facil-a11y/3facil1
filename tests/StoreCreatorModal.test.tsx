// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { 
  StoreCreatorModal, 
  mapRegisterError 
} from '../src/components/admin/StoreCreatorModal';
import { apiService } from '../src/services/apiService';

const mockRefreshDatabaseStatus = vi.fn().mockResolvedValue(undefined);
const mockSelectStore = vi.fn();
const mockUpsertStoreInState = vi.fn();
let mockCurrentUser: any = null;

vi.mock('../src/context/StoreContext', () => ({
  useStoreContext: () => ({
    theme: 'dark',
    currentUser: mockCurrentUser,
    refreshDatabaseStatus: mockRefreshDatabaseStatus,
    selectStore: mockSelectStore,
    upsertStoreInState: mockUpsertStoreInState,
  }),
}));

vi.mock('../src/services/apiService', () => ({
  apiService: {
    register: vi.fn(),
    saveStore: vi.fn(),
  },
}));

describe('StoreCreatorModal - Tratamento de Erros e Usabilidade', () => {
  const scrollIntoViewMock = vi.fn();
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = null;
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    window.Element.prototype.scrollIntoView = scrollIntoViewMock;
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Função mapRegisterError (Mapeamento de Status HTTP)', () => {
    it('mapeia 409 para mensagem de e-mail já cadastrado', () => {
      const msg = mapRegisterError({
        status: 409,
        error: 'Conflict'
      });
      expect(msg).toBe('Este e-mail já está cadastrado. Use outro ou faça login.');
    });

    it('mapeia 429 para mensagem de limite de tentativas', () => {
      const msg = mapRegisterError({
        status: 429,
        error: 'Too Many Requests'
      });
      expect(msg).toBe('Muitas tentativas. Aguarde alguns minutos e tente de novo.');
    });

    it('mapeia 503 para mensagem de serviço indisponível', () => {
      const msg = mapRegisterError({
        status: 503,
        error: 'Service Unavailable'
      });
      expect(msg).toBe('Serviço temporariamente indisponível. Tente novamente em instantes.');
    });

    it('mapeia 400 com details contendo campo e mensagem', () => {
      const msg = mapRegisterError({
        status: 400,
        error: 'Validation failed',
        details: [
          { field: 'password', message: 'A senha de acesso deve conter no mínimo 10 caracteres.' }
        ]
      });
      expect(msg).toBe('password: A senha de acesso deve conter no mínimo 10 caracteres.');
    });

    it('mapeia 400 sem details exibindo mensagem de erro do servidor', () => {
      const msg = mapRegisterError({
        status: 400,
        error: 'Telefone inválido ou incompleto.'
      });
      expect(msg).toBe('Telefone inválido ou incompleto.');
    });

    it('detecta texto "já cadastrado" no erro caso venha sem status 409 explícito', () => {
      const msg = mapRegisterError({
        error: 'E-mail já cadastrado na plataforma.'
      });
      expect(msg).toBe('Este e-mail já está cadastrado. Use outro ou faça login.');
    });
  });

  describe('Componente StoreCreatorModal - Exibição, Scroll e Foco de Erro', () => {
    const fillValidForm = () => {
      fireEvent.change(screen.getByPlaceholderText(/RentPro Locadora/i), {
        target: { value: 'Auto Peças Modelo' }
      });
      fireEvent.change(screen.getByPlaceholderText(/11987654321/i), {
        target: { value: '11988887777' }
      });
      fireEvent.change(screen.getByPlaceholderText(/contato@minhaloja.com.br/i), {
        target: { value: 'contato@modelo.com' }
      });
      fireEvent.change(screen.getByPlaceholderText(/Mínimo 10 caracteres/i), {
        target: { value: 'SenhaSegura123!' }
      });
    };

    it('rola suavemente e foca na faixa de erro no topo com role="alert" ao falhar com 409', async () => {
      vi.mocked(apiService.register).mockResolvedValueOnce({
        success: false,
        status: 409,
        error: 'Conflict'
      });

      render(<StoreCreatorModal isOpen={true} onClose={onCloseMock} />);

      fillValidForm();

      const submitButton = screen.getByRole('button', { name: /Criar Loja/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('top-error-message')).not.toBeNull();
        expect(scrollIntoViewMock).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'start'
        });
      });

      const topBanner = screen.getByTestId('top-error-message');
      expect(topBanner.getAttribute('role')).toBe('alert');
      expect(topBanner.textContent).toContain('Este e-mail já está cadastrado. Use outro ou faça login.');

      // Verifica foco no elemento de erro
      expect(document.activeElement).toBe(topBanner);
    });

    it('exibe a mensagem de erro também logo acima do botão "Criar Loja"', async () => {
      vi.mocked(apiService.register).mockResolvedValueOnce({
        success: false,
        status: 409,
        error: 'Conflict'
      });

      render(<StoreCreatorModal isOpen={true} onClose={onCloseMock} />);

      fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: /Criar Loja/i }));

      await waitFor(() => {
        expect(screen.getByTestId('bottom-error-message')).not.toBeNull();
      });

      const bottomBanner = screen.getByTestId('bottom-error-message');
      expect(bottomBanner.getAttribute('role')).toBe('alert');
      expect(bottomBanner.textContent).toContain('Este e-mail já está cadastrado. Use outro ou faça login.');

      // Verifica que o banner inferior está presente logo acima do container dos botões de ação
      const submitBtn = screen.getByRole('button', { name: /Criar Loja/i });
      expect(bottomBanner.nextElementSibling?.contains(submitBtn)).toBe(true);
    });

    it('mapeia erro 429 para "Muitas tentativas. Aguarde alguns minutos e tente de novo."', async () => {
      vi.mocked(apiService.register).mockResolvedValueOnce({
        success: false,
        status: 429,
        error: 'Rate limited'
      });

      render(<StoreCreatorModal isOpen={true} onClose={onCloseMock} />);

      fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: /Criar Loja/i }));

      await waitFor(() => {
        expect(screen.getByTestId('top-error-message').textContent).toContain(
          'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
        );
        expect(screen.getByTestId('bottom-error-message').textContent).toContain(
          'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
        );
      });
    });

    it('mapeia erro 503 para "Serviço temporariamente indisponível. Tente novamente em instantes."', async () => {
      vi.mocked(apiService.register).mockResolvedValueOnce({
        success: false,
        status: 503,
        error: 'DB unavailable'
      });

      render(<StoreCreatorModal isOpen={true} onClose={onCloseMock} />);

      fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: /Criar Loja/i }));

      await waitFor(() => {
        expect(screen.getByTestId('top-error-message').textContent).toContain(
          'Serviço temporariamente indisponível. Tente novamente em instantes.'
        );
        expect(screen.getByTestId('bottom-error-message').textContent).toContain(
          'Serviço temporariamente indisponível. Tente novamente em instantes.'
        );
      });
    });

    it('mapeia erro 400 exibindo o campo e a mensagem de validação do servidor', async () => {
      vi.mocked(apiService.register).mockResolvedValueOnce({
        success: false,
        status: 400,
        error: 'Validation error',
        details: [
          { field: 'whatsapp', message: 'Número de WhatsApp deve conter DDD e entre 10 e 11 dígitos' }
        ]
      });

      render(<StoreCreatorModal isOpen={true} onClose={onCloseMock} />);

      fillValidForm();

      fireEvent.click(screen.getByRole('button', { name: /Criar Loja/i }));

      await waitFor(() => {
        const expected = 'whatsapp: Número de WhatsApp deve conter DDD e entre 10 e 11 dígitos';
        expect(screen.getByTestId('top-error-message').textContent).toContain(expected);
        expect(screen.getByTestId('bottom-error-message').textContent).toContain(expected);
      });
    });

    it('mantém o botão desabilitado com spinner e a legenda "Criando loja..." durante o envio', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(apiService.register).mockReturnValueOnce(pendingPromise as any);

      render(<StoreCreatorModal isOpen={true} onClose={onCloseMock} />);

      fillValidForm();

      const button = screen.getByRole('button', { name: /Criar Loja/i }) as HTMLButtonElement;
      fireEvent.click(button);

      // Botão deve estar desabilitado
      expect(button.disabled).toBe(true);

      // Botão deve exibir a legenda "Criando loja..."
      expect(screen.getByText('Criando loja...')).not.toBeNull();

      // Finaliza a requisição
      await act(async () => {
        resolvePromise({
          success: true,
          store: {
            id: 'store-123',
            name: 'Auto Peças Modelo',
            slug: 'auto-pecas-modelo',
            type: 'veiculo',
            isPublished: false
          }
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/Cadastro realizado com sucesso!/i)).not.toBeNull();
      });
    });

    it('permite selecionar "Prestador de Serviços" e envia type: "servico" no cadastro público e pelo Painel Master', async () => {
      vi.mocked(apiService.register).mockResolvedValueOnce({
        success: true,
        emailQueued: true,
        store: {
          id: 'store-svc-1',
          name: 'Prestação Ágil',
          slug: 'prestacao-agil',
          type: 'servico',
          isPublished: false,
        } as any,
      });

      const { unmount } = render(<StoreCreatorModal isOpen={true} onClose={onCloseMock} />);

      fireEvent.click(screen.getByText('Prestador de Serviços'));
      fireEvent.change(screen.getByPlaceholderText(/RentPro Locadora/i), {
        target: { value: 'Prestação Ágil' }
      });
      fireEvent.change(screen.getByPlaceholderText(/11987654321/i), {
        target: { value: '11988887777' }
      });
      fireEvent.change(screen.getByPlaceholderText(/contato@minhaloja.com.br/i), {
        target: { value: 'servico@agil.com' }
      });
      fireEvent.change(screen.getByPlaceholderText(/Mínimo 10 caracteres/i), {
        target: { value: 'SenhaSegura123!' }
      });

      fireEvent.click(screen.getByRole('button', { name: /Criar Loja/i }));

      await waitFor(() => {
        expect(apiService.register).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Prestação Ágil',
            type: 'servico',
            state: 'SP',
          })
        );
        expect(mockRefreshDatabaseStatus).toHaveBeenCalled();
        expect(mockUpsertStoreInState).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'store-svc-1', type: 'servico' })
        );
        expect(mockSelectStore).toHaveBeenCalledWith('store-svc-1');
        expect(screen.getByText(/Modelo: Prestador de Serviços/i)).not.toBeNull();
      });

      unmount();

      // Agora simula Super Admin criando loja de serviço via Painel Master
      mockCurrentUser = { id: 'admin', name: 'Master', email: 'admin@3facil.com', role: 'superadmin' };
      vi.mocked(apiService.saveStore).mockResolvedValueOnce({
        success: true,
        store: {
          id: 'store-svc-master',
          name: 'Serviços & Manutenção Ótima',
          slug: 'servicos-manutencao-otima',
          type: 'servico',
          isPublished: true,
        } as any,
      });

      render(<StoreCreatorModal isOpen={true} onClose={onCloseMock} />);

      fireEvent.click(screen.getByText('Prestador de Serviços'));
      fireEvent.change(screen.getByPlaceholderText(/RentPro Locadora/i), {
        target: { value: 'Serviços & Manutenção Ótima' }
      });
      fireEvent.change(screen.getByPlaceholderText(/11987654321/i), {
        target: { value: '41999887766' }
      });
      fireEvent.change(screen.getByPlaceholderText(/contato@minhaloja.com.br/i), {
        target: { value: 'master-svc@agil.com' }
      });

      fireEvent.click(screen.getByRole('button', { name: /Criar Loja/i }));

      await waitFor(() => {
        expect(apiService.saveStore).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Serviços & Manutenção Ótima',
            slug: 'servicos-manutencao-otima',
            type: 'servico',
            state: 'SP',
          })
        );
        expect(mockUpsertStoreInState).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'store-svc-master', type: 'servico' })
        );
        expect(mockSelectStore).toHaveBeenCalledWith('store-svc-master');
        expect(screen.getByText(/Loja "Serviços & Manutenção Ótima" criada com sucesso!/i)).not.toBeNull();
      });
    });

    it('respeita initialType="produto" pré-selecionado pelos cards da Landing Page', async () => {
      vi.mocked(apiService.register).mockResolvedValueOnce({
        success: true,
        emailQueued: true,
        store: {
          id: 'store-prod-init',
          name: 'Eletrônicos Express',
          slug: 'eletronicos-express',
          type: 'produto',
          isPublished: false,
        } as any,
      });

      render(<StoreCreatorModal isOpen={true} onClose={onCloseMock} initialType="produto" />);

      fireEvent.change(screen.getByPlaceholderText(/RentPro Locadora/i), {
        target: { value: 'Eletrônicos Express' }
      });
      fireEvent.change(screen.getByPlaceholderText(/11987654321/i), {
        target: { value: '11988887777' }
      });
      fireEvent.change(screen.getByPlaceholderText(/contato@minhaloja.com.br/i), {
        target: { value: 'vendas@eletronicos.com' }
      });
      fireEvent.change(screen.getByPlaceholderText(/Mínimo 10 caracteres/i), {
        target: { value: 'SenhaSegura123!' }
      });

      fireEvent.click(screen.getByRole('button', { name: /Criar Loja/i }));

      await waitFor(() => {
        expect(apiService.register).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'produto', name: 'Eletrônicos Express' })
        );
        expect(mockSelectStore).toHaveBeenCalledWith('store-prod-init');
        expect(screen.getByText(/Modelo: Produtos Físicos/i)).not.toBeNull();
      });
    });
  });
});

export type VehicleStatus = 'disponivel' | 'em_viagem' | 'manutencao' | 'inativo';

export type VehicleCategory = 'passeio' | 'utilitario' | 'caminhao' | 'van' | 'moto';

export type FuelType = 'Flex (Gasolina/Etanol)' | 'Gasolina' | 'Etanol' | 'Diesel S10' | 'Diesel S500' | 'GNV' | 'Eletrico';

export interface ChecklistItem {
  id: string;
  label: string;
  status: 'ok' | 'avaria' | 'nao_se_aplica';
  observacao?: string;
}

export interface Vehicle {
  id: string;
  placa: string;
  modelo: string;
  marca: string;
  ano: number;
  cor: string;
  categoria: VehicleCategory;
  combustivel: FuelType;
  kmAtual: number;
  tanqueAtual: 'reserva' | '1/4' | '1/2' | '3/4' | 'cheio';
  status: VehicleStatus;
  renavam?: string;
  chassi?: string;
  capacidadeTanqueLitros?: number;
  proximaTrocaOleoKm?: number;
  proximaRevisaoData?: string;
  dataAquisicao?: string;
  valorCompra?: number;
  observacoes?: string;
  fotoUrl?: string;
}

export interface Driver {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  cnhNumero: string;
  cnhCategoria: 'A' | 'B' | 'AB' | 'C' | 'D' | 'E';
  cnhValidade: string;
  status: 'ativo' | 'em_viagem' | 'ferias' | 'inativo';
  cargo: string;
  departamento?: string;
  email?: string;
  dataAdmissao?: string;
  pontuacaoZelo?: number; // 1 a 5
}

export interface TripLog {
  id: string;
  veiculoId: string;
  motoristaId: string;
  destino: string;
  motivo: string;
  dataSaida: string; // ISO date string
  kmSaida: number;
  tanqueSaida: 'reserva' | '1/4' | '1/2' | '3/4' | 'cheio';
  checklistSaida: ChecklistItem[];
  
  dataRetorno?: string;
  kmRetorno?: number;
  kmPercorrido?: number;
  tanqueRetorno?: 'reserva' | '1/4' | '1/2' | '3/4' | 'cheio';
  checklistRetorno?: ChecklistItem[];
  observacoesRetorno?: string;
  status: 'em_andamento' | 'concluida' | 'cancelada';
  criadoEm: string;
}

export interface FuelLog {
  id: string;
  veiculoId: string;
  motoristaId?: string;
  data: string;
  posto: string;
  tipoCombustivel: string;
  litros: number;
  precoPorLitro: number;
  valorTotal: number;
  kmMomento: number;
  tanqueCheio: boolean;
  kmPorLitroCalculado?: number;
  comprovanteNumero?: string;
  observacoes?: string;
}

export type MaintenanceType = 'preventiva' | 'corretiva' | 'revisao_periodica' | 'pneus' | 'oleo_filtros' | 'freios' | 'eletrica';

export interface MaintenanceLog {
  id: string;
  veiculoId: string;
  tipo: MaintenanceType;
  descricao: string;
  dataAgendada: string;
  dataRealizada?: string;
  kmRealizacao?: number;
  proximaTrocaKm?: number;
  oficina: string;
  custoPecas: number;
  custoMaoDeObra: number;
  custoTotal: number;
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  notaFiscal?: string;
  observacoes?: string;
}

export interface FleetStats {
  totalVeiculos: number;
  veiculosDisponiveis: number;
  veiculosEmViagem: number;
  veiculosManutencao: number;
  totalMotoristas: number;
  kmRodadoMes: number;
  custoCombustivelMes: number;
  custoManutencaoMes: number;
  viagensAtivas: number;
  alertasRevisao: number;
  alertasCnh: number;
}

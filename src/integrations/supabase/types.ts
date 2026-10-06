export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acordos_historico: {
        Row: {
          acao: string
          campos_alterados: string[] | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          observacao: string | null
          organizacao_id: string | null
          tarefa_id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          observacao?: string | null
          organizacao_id?: string | null
          tarefa_id: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          observacao?: string | null
          organizacao_id?: string | null
          tarefa_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acordos_historico_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "acordos_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordos_historico_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "portal_cliente_acordos_view"
            referencedColumns: ["id"]
          },
        ]
      }
      acordos_tarefas: {
        Row: {
          cliente_id: string | null
          concluida: boolean
          contrato_id: string | null
          created_at: string
          created_by: string
          data_vencimento: string
          descricao: string | null
          id: string
          intervalo_recorrencia: string | null
          nome_cliente: string | null
          observacoes: string | null
          organizacao_id: string
          prioridade: string
          proxima_geracao: string | null
          recorrente: boolean
          responsavel_id: string
          resultado_tentativa: string | null
          status: string
          tarefa_origem_id: string | null
          titulo: string
          updated_at: string
          valor_acordo: number | null
          visivel_cliente: boolean
        }
        Insert: {
          cliente_id?: string | null
          concluida?: boolean
          contrato_id?: string | null
          created_at?: string
          created_by: string
          data_vencimento: string
          descricao?: string | null
          id?: string
          intervalo_recorrencia?: string | null
          nome_cliente?: string | null
          observacoes?: string | null
          organizacao_id: string
          prioridade?: string
          proxima_geracao?: string | null
          recorrente?: boolean
          responsavel_id: string
          resultado_tentativa?: string | null
          status?: string
          tarefa_origem_id?: string | null
          titulo: string
          updated_at?: string
          valor_acordo?: number | null
          visivel_cliente?: boolean
        }
        Update: {
          cliente_id?: string | null
          concluida?: boolean
          contrato_id?: string | null
          created_at?: string
          created_by?: string
          data_vencimento?: string
          descricao?: string | null
          id?: string
          intervalo_recorrencia?: string | null
          nome_cliente?: string | null
          observacoes?: string | null
          organizacao_id?: string
          prioridade?: string
          proxima_geracao?: string | null
          recorrente?: boolean
          responsavel_id?: string
          resultado_tentativa?: string | null
          status?: string
          tarefa_origem_id?: string | null
          titulo?: string
          updated_at?: string
          valor_acordo?: number | null
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "acordos_tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordos_tarefas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_vencimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordos_tarefas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "portal_cliente_contratos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordos_tarefas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordos_tarefas_tarefa_origem_id_fkey"
            columns: ["tarefa_origem_id"]
            isOneToOne: false
            referencedRelation: "acordos_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordos_tarefas_tarefa_origem_id_fkey"
            columns: ["tarefa_origem_id"]
            isOneToOne: false
            referencedRelation: "portal_cliente_acordos_view"
            referencedColumns: ["id"]
          },
        ]
      }
      advbox_agenda: {
        Row: {
          advbox_id: string
          cliente_nome: string | null
          concluida: boolean
          created_at: string
          data: string
          descricao: string | null
          hora: string | null
          id: string
          organizacao_id: string
          raw: Json | null
          responsavel_email: string | null
          responsavel_id: string | null
          status: string | null
          synced_at: string
          titulo: string
          updated_at: string
        }
        Insert: {
          advbox_id: string
          cliente_nome?: string | null
          concluida?: boolean
          created_at?: string
          data: string
          descricao?: string | null
          hora?: string | null
          id?: string
          organizacao_id: string
          raw?: Json | null
          responsavel_email?: string | null
          responsavel_id?: string | null
          status?: string | null
          synced_at?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          advbox_id?: string
          cliente_nome?: string | null
          concluida?: boolean
          created_at?: string
          data?: string
          descricao?: string | null
          hora?: string | null
          id?: string
          organizacao_id?: string
          raw?: Json | null
          responsavel_email?: string | null
          responsavel_id?: string | null
          status?: string | null
          synced_at?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      advbox_clientes_alias: {
        Row: {
          advbox_customers_id: string
          cliente_id: string
          conferido_em: string | null
          created_at: string
          motivo: string | null
          organizacao_id: string
        }
        Insert: {
          advbox_customers_id: string
          cliente_id: string
          conferido_em?: string | null
          created_at?: string
          motivo?: string | null
          organizacao_id: string
        }
        Update: {
          advbox_customers_id?: string
          cliente_id?: string
          conferido_em?: string | null
          created_at?: string
          motivo?: string | null
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advbox_clientes_alias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advbox_clientes_alias_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      advbox_disparos: {
        Row: {
          bloqueios: Json
          cliente_id: string | null
          created_at: string
          customers_id: string | null
          detalhes: Json
          disparado_por: string | null
          id: string
          motivo: string | null
          organizacao_id: string | null
          processos: Json
          tarefas: number
        }
        Insert: {
          bloqueios?: Json
          cliente_id?: string | null
          created_at?: string
          customers_id?: string | null
          detalhes?: Json
          disparado_por?: string | null
          id?: string
          motivo?: string | null
          organizacao_id?: string | null
          processos?: Json
          tarefas?: number
        }
        Update: {
          bloqueios?: Json
          cliente_id?: string | null
          created_at?: string
          customers_id?: string | null
          detalhes?: Json
          disparado_por?: string | null
          id?: string
          motivo?: string | null
          organizacao_id?: string | null
          processos?: Json
          tarefas?: number
        }
        Relationships: [
          {
            foreignKeyName: "advbox_disparos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      advbox_foto_clientes_antes: {
        Row: {
          advbox_customers_id: string | null
          aguardando_distribuicao: boolean | null
          area_hectares: number | null
          base_historica_advbox: boolean | null
          cadastrado_em: string | null
          cadastrado_por: string | null
          cep: string | null
          cpf_cnpj: string | null
          cpf_observacao: string | null
          cpf_origem: string | null
          cpf_origem_em: string | null
          created_at: string | null
          cultura_principal: string | null
          deleted_at: string | null
          email: string | null
          encerramento_comunicado_arquivo: string | null
          encerramento_comunicado_canal: string | null
          encerramento_comunicado_em: string | null
          encerramento_comunicado_por: string | null
          encerramento_comunicado_registrado_em: string | null
          endereco: string | null
          estado_civil: string | null
          grafias_alternativas: string[] | null
          grupo: string | null
          id: string | null
          municipio: string | null
          nacionalidade: string | null
          nome: string | null
          nome_propriedade: string | null
          nps: number | null
          observacoes: string | null
          organizacao_id: string | null
          orgao_emissor: string | null
          profissao: string | null
          responsavel_pos_venda: string | null
          rg: string | null
          risco: string | null
          situacao: string | null
          situacao_alterada_em: string | null
          situacao_alterada_por: string | null
          situacao_motivo: string | null
          status_adimplencia: string | null
          telefone: string | null
          triado_em: string | null
          triagem_origem: string | null
          uf: string | null
          updated_at: string | null
          user_id: string | null
          vip: boolean | null
        }
        Insert: {
          advbox_customers_id?: string | null
          aguardando_distribuicao?: boolean | null
          area_hectares?: number | null
          base_historica_advbox?: boolean | null
          cadastrado_em?: string | null
          cadastrado_por?: string | null
          cep?: string | null
          cpf_cnpj?: string | null
          cpf_observacao?: string | null
          cpf_origem?: string | null
          cpf_origem_em?: string | null
          created_at?: string | null
          cultura_principal?: string | null
          deleted_at?: string | null
          email?: string | null
          encerramento_comunicado_arquivo?: string | null
          encerramento_comunicado_canal?: string | null
          encerramento_comunicado_em?: string | null
          encerramento_comunicado_por?: string | null
          encerramento_comunicado_registrado_em?: string | null
          endereco?: string | null
          estado_civil?: string | null
          grafias_alternativas?: string[] | null
          grupo?: string | null
          id?: string | null
          municipio?: string | null
          nacionalidade?: string | null
          nome?: string | null
          nome_propriedade?: string | null
          nps?: number | null
          observacoes?: string | null
          organizacao_id?: string | null
          orgao_emissor?: string | null
          profissao?: string | null
          responsavel_pos_venda?: string | null
          rg?: string | null
          risco?: string | null
          situacao?: string | null
          situacao_alterada_em?: string | null
          situacao_alterada_por?: string | null
          situacao_motivo?: string | null
          status_adimplencia?: string | null
          telefone?: string | null
          triado_em?: string | null
          triagem_origem?: string | null
          uf?: string | null
          updated_at?: string | null
          user_id?: string | null
          vip?: boolean | null
        }
        Update: {
          advbox_customers_id?: string | null
          aguardando_distribuicao?: boolean | null
          area_hectares?: number | null
          base_historica_advbox?: boolean | null
          cadastrado_em?: string | null
          cadastrado_por?: string | null
          cep?: string | null
          cpf_cnpj?: string | null
          cpf_observacao?: string | null
          cpf_origem?: string | null
          cpf_origem_em?: string | null
          created_at?: string | null
          cultura_principal?: string | null
          deleted_at?: string | null
          email?: string | null
          encerramento_comunicado_arquivo?: string | null
          encerramento_comunicado_canal?: string | null
          encerramento_comunicado_em?: string | null
          encerramento_comunicado_por?: string | null
          encerramento_comunicado_registrado_em?: string | null
          endereco?: string | null
          estado_civil?: string | null
          grafias_alternativas?: string[] | null
          grupo?: string | null
          id?: string | null
          municipio?: string | null
          nacionalidade?: string | null
          nome?: string | null
          nome_propriedade?: string | null
          nps?: number | null
          observacoes?: string | null
          organizacao_id?: string | null
          orgao_emissor?: string | null
          profissao?: string | null
          responsavel_pos_venda?: string | null
          rg?: string | null
          risco?: string | null
          situacao?: string | null
          situacao_alterada_em?: string | null
          situacao_alterada_por?: string | null
          situacao_motivo?: string | null
          status_adimplencia?: string | null
          telefone?: string | null
          triado_em?: string | null
          triagem_origem?: string | null
          uf?: string | null
          updated_at?: string | null
          user_id?: string | null
          vip?: boolean | null
        }
        Relationships: []
      }
      advbox_importacao_execucoes: {
        Row: {
          atualizado_em: string
          contagens: Json
          created_at: string
          erro: string | null
          etapa: string
          id: string
          iniciado_por: string | null
          modo: string
          offset_atual: number
          organizacao_id: string
          relatorio: Json | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          contagens?: Json
          created_at?: string
          erro?: string | null
          etapa?: string
          id?: string
          iniciado_por?: string | null
          modo?: string
          offset_atual?: number
          organizacao_id: string
          relatorio?: Json | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          contagens?: Json
          created_at?: string
          erro?: string | null
          etapa?: string
          id?: string
          iniciado_por?: string | null
          modo?: string
          offset_atual?: number
          organizacao_id?: string
          relatorio?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "advbox_importacao_execucoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      advbox_pendencias: {
        Row: {
          criado_em: string
          descricao: string | null
          id: string
          organizacao_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          descricao?: string | null
          id?: string
          organizacao_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          tipo: string
          titulo: string
        }
        Update: {
          criado_em?: string
          descricao?: string | null
          id?: string
          organizacao_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      advbox_processos_marcas: {
        Row: {
          advbox_lawsuits_id: string
          criado_em: string
          criado_por: string | null
          id: string
          marca: string
          observacao: string | null
          organizacao_id: string | null
          referencia_lawsuits_id: string | null
        }
        Insert: {
          advbox_lawsuits_id: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          marca: string
          observacao?: string | null
          organizacao_id?: string | null
          referencia_lawsuits_id?: string | null
        }
        Update: {
          advbox_lawsuits_id?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          marca?: string
          observacao?: string | null
          organizacao_id?: string | null
          referencia_lawsuits_id?: string | null
        }
        Relationships: []
      }
      advbox_reconciliacao: {
        Row: {
          criado_em: string
          criado_por: string | null
          detalhe: Json
          fase: string
          id: string
          organizacao_id: string | null
          resumo: Json
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          detalhe?: Json
          fase?: string
          id?: string
          organizacao_id?: string | null
          resumo?: Json
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          detalhe?: Json
          fase?: string
          id?: string
          organizacao_id?: string | null
          resumo?: Json
        }
        Relationships: []
      }
      advbox_sync_log: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          registros_sincronizados: number
          status: string
          tipo_sync: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          registros_sincronizados?: number
          status?: string
          tipo_sync?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          registros_sincronizados?: number
          status?: string
          tipo_sync?: string
          user_id?: string | null
        }
        Relationships: []
      }
      advbox_tarefas_criadas: {
        Row: {
          advbox_post_id: string | null
          banco: string | null
          cliente_id: string | null
          created_at: string
          data_alvo: string | null
          data_desatualizada: boolean
          data_desatualizada_em: string | null
          data_nova: string | null
          data_prazo: string | null
          id: string
          lawsuits_id: string
          operacao_id: string | null
          organizacao_id: string | null
          origem: string | null
          post_id_pendente: boolean
          tasks_id: string
          texto: string | null
          urgente: boolean
          users_id: string | null
        }
        Insert: {
          advbox_post_id?: string | null
          banco?: string | null
          cliente_id?: string | null
          created_at?: string
          data_alvo?: string | null
          data_desatualizada?: boolean
          data_desatualizada_em?: string | null
          data_nova?: string | null
          data_prazo?: string | null
          id?: string
          lawsuits_id: string
          operacao_id?: string | null
          organizacao_id?: string | null
          origem?: string | null
          post_id_pendente?: boolean
          tasks_id: string
          texto?: string | null
          urgente?: boolean
          users_id?: string | null
        }
        Update: {
          advbox_post_id?: string | null
          banco?: string | null
          cliente_id?: string | null
          created_at?: string
          data_alvo?: string | null
          data_desatualizada?: boolean
          data_desatualizada_em?: string | null
          data_nova?: string | null
          data_prazo?: string | null
          id?: string
          lawsuits_id?: string
          operacao_id?: string | null
          organizacao_id?: string | null
          origem?: string | null
          post_id_pendente?: boolean
          tasks_id?: string
          texto?: string | null
          urgente?: boolean
          users_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advbox_tarefas_criadas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advbox_tarefas_criadas_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      analise_chat_mensagens: {
        Row: {
          analise_id: string | null
          arquivo_hash: string | null
          content: string
          created_at: string
          id: string
          organizacao_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          analise_id?: string | null
          arquivo_hash?: string | null
          content: string
          created_at?: string
          id?: string
          organizacao_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          analise_id?: string | null
          arquivo_hash?: string | null
          content?: string
          created_at?: string
          id?: string
          organizacao_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      analise_contrato_jobs: {
        Row: {
          arquivo_hash: string | null
          cliente_nome: string | null
          created_at: string
          error: string | null
          id: string
          modelo: string | null
          operador_id: string | null
          organizacao_id: string | null
          provedor: string | null
          result_raw: string | null
          status: string
          updated_at: string
        }
        Insert: {
          arquivo_hash?: string | null
          cliente_nome?: string | null
          created_at?: string
          error?: string | null
          id?: string
          modelo?: string | null
          operador_id?: string | null
          organizacao_id?: string | null
          provedor?: string | null
          result_raw?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          arquivo_hash?: string | null
          cliente_nome?: string | null
          created_at?: string
          error?: string | null
          id?: string
          modelo?: string | null
          operador_id?: string | null
          organizacao_id?: string | null
          provedor?: string | null
          result_raw?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      analises_contratos: {
        Row: {
          arquivo_hash: string | null
          arquivo_nome: string | null
          citacoes: Json | null
          classificacao: string | null
          cliente_nome: string
          comparativo_bacen: Json | null
          contexto_adicional: string | null
          created_at: string
          id: string
          operador_id: string | null
          organizacao_id: string | null
          parecer_completo: string | null
          resumo_executivo: Json | null
          tipo_contrato: string
        }
        Insert: {
          arquivo_hash?: string | null
          arquivo_nome?: string | null
          citacoes?: Json | null
          classificacao?: string | null
          cliente_nome: string
          comparativo_bacen?: Json | null
          contexto_adicional?: string | null
          created_at?: string
          id?: string
          operador_id?: string | null
          organizacao_id?: string | null
          parecer_completo?: string | null
          resumo_executivo?: Json | null
          tipo_contrato: string
        }
        Update: {
          arquivo_hash?: string | null
          arquivo_nome?: string | null
          citacoes?: Json | null
          classificacao?: string | null
          cliente_nome?: string
          comparativo_bacen?: Json | null
          contexto_adicional?: string | null
          created_at?: string
          id?: string
          operador_id?: string | null
          organizacao_id?: string | null
          parecer_completo?: string | null
          resumo_executivo?: Json | null
          tipo_contrato?: string
        }
        Relationships: []
      }
      analises_ia: {
        Row: {
          created_at: string
          id: string
          laudo_id: string
          modelo: string | null
          resultado: Json
          tokens_usados: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          laudo_id: string
          modelo?: string | null
          resultado?: Json
          tokens_usados?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          laudo_id?: string
          modelo?: string | null
          resultado?: Json
          tokens_usados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analises_ia_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "laudos"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          nome: string
          organizacao_id: string
          revoked_at: string | null
          scopes: string[]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          nome: string
          organizacao_id: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          nome?: string
          organizacao_id?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_secrets: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      arquivos_cliente: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          deleted_at: string | null
          id: string
          motivo_rejeicao: string | null
          nome_arquivo: string
          nome_cliente: string
          organizacao_id: string | null
          origem: string
          pasta: string | null
          status_aprovacao: string
          storage_path: string
          tamanho_bytes: number | null
          user_id: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          motivo_rejeicao?: string | null
          nome_arquivo: string
          nome_cliente: string
          organizacao_id?: string | null
          origem?: string
          pasta?: string | null
          status_aprovacao?: string
          storage_path: string
          tamanho_bytes?: number | null
          user_id: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          motivo_rejeicao?: string | null
          nome_arquivo?: string
          nome_cliente?: string
          organizacao_id?: string | null
          origem?: string
          pasta?: string | null
          status_aprovacao?: string
          storage_path?: string
          tamanho_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arquivos_cliente_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      assinatura_config: {
        Row: {
          escritorio_cpf: string | null
          escritorio_email: string | null
          escritorio_nome: string | null
          organizacao_id: string
          updated_at: string
          webhook_id: string | null
          webhook_registrado_em: string | null
        }
        Insert: {
          escritorio_cpf?: string | null
          escritorio_email?: string | null
          escritorio_nome?: string | null
          organizacao_id: string
          updated_at?: string
          webhook_id?: string | null
          webhook_registrado_em?: string | null
        }
        Update: {
          escritorio_cpf?: string | null
          escritorio_email?: string | null
          escritorio_nome?: string | null
          organizacao_id?: string
          updated_at?: string
          webhook_id?: string | null
          webhook_registrado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_config_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: true
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      assinatura_documentos: {
        Row: {
          arquivo_cliente_id: string | null
          assinado_path: string | null
          canal: string
          cliente_id: string | null
          created_at: string
          enviado_em: string | null
          enviado_por: string | null
          formato: string
          id: string
          incluir_escritorio: boolean
          marcadores_encontrados: boolean
          nome: string
          organizacao_id: string
          origem: string
          original_path: string | null
          prazo: string | null
          referencia: string | null
          sem_visto: boolean
          setor: string | null
          status: string
          tipo: string
          ultimo_sync_em: string | null
          updated_at: string
          zapsign_token: string | null
        }
        Insert: {
          arquivo_cliente_id?: string | null
          assinado_path?: string | null
          canal?: string
          cliente_id?: string | null
          created_at?: string
          enviado_em?: string | null
          enviado_por?: string | null
          formato?: string
          id?: string
          incluir_escritorio?: boolean
          marcadores_encontrados?: boolean
          nome: string
          organizacao_id: string
          origem?: string
          original_path?: string | null
          prazo?: string | null
          referencia?: string | null
          sem_visto?: boolean
          setor?: string | null
          status?: string
          tipo?: string
          ultimo_sync_em?: string | null
          updated_at?: string
          zapsign_token?: string | null
        }
        Update: {
          arquivo_cliente_id?: string | null
          assinado_path?: string | null
          canal?: string
          cliente_id?: string | null
          created_at?: string
          enviado_em?: string | null
          enviado_por?: string | null
          formato?: string
          id?: string
          incluir_escritorio?: boolean
          marcadores_encontrados?: boolean
          nome?: string
          organizacao_id?: string
          origem?: string
          original_path?: string | null
          prazo?: string | null
          referencia?: string | null
          sem_visto?: boolean
          setor?: string | null
          status?: string
          tipo?: string
          ultimo_sync_em?: string | null
          updated_at?: string
          zapsign_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_documentos_arquivo_cliente_id_fkey"
            columns: ["arquivo_cliente_id"]
            isOneToOne: false
            referencedRelation: "arquivos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinatura_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinatura_documentos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      assinatura_eventos: {
        Row: {
          chave_idempotencia: string | null
          documento_id: string | null
          erro: string | null
          id: string
          organizacao_id: string | null
          payload: Json | null
          processado_em: string | null
          recebido_em: string
          tipo: string | null
          zapsign_doc_token: string | null
        }
        Insert: {
          chave_idempotencia?: string | null
          documento_id?: string | null
          erro?: string | null
          id?: string
          organizacao_id?: string | null
          payload?: Json | null
          processado_em?: string | null
          recebido_em?: string
          tipo?: string | null
          zapsign_doc_token?: string | null
        }
        Update: {
          chave_idempotencia?: string | null
          documento_id?: string | null
          erro?: string | null
          id?: string
          organizacao_id?: string | null
          payload?: Json | null
          processado_em?: string | null
          recebido_em?: string
          tipo?: string | null
          zapsign_doc_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_eventos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "assinatura_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinatura_eventos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      assinatura_signatarios: {
        Row: {
          assinou_em: string | null
          cliente_id: string | null
          cpf: string | null
          created_at: string
          documento_id: string
          email: string | null
          id: string
          nome: string
          organizacao_id: string
          papel: string
          qualificacao: string | null
          recusou_em: string | null
          sign_url: string | null
          status: string
          telefone: string | null
          visualizou_em: string | null
          zapsign_token: string | null
        }
        Insert: {
          assinou_em?: string | null
          cliente_id?: string | null
          cpf?: string | null
          created_at?: string
          documento_id: string
          email?: string | null
          id?: string
          nome: string
          organizacao_id: string
          papel?: string
          qualificacao?: string | null
          recusou_em?: string | null
          sign_url?: string | null
          status?: string
          telefone?: string | null
          visualizou_em?: string | null
          zapsign_token?: string | null
        }
        Update: {
          assinou_em?: string | null
          cliente_id?: string | null
          cpf?: string | null
          created_at?: string
          documento_id?: string
          email?: string | null
          id?: string
          nome?: string
          organizacao_id?: string
          papel?: string
          qualificacao?: string | null
          recusou_em?: string | null
          sign_url?: string | null
          status?: string
          telefone?: string | null
          visualizou_em?: string | null
          zapsign_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_signatarios_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "assinatura_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinatura_signatarios_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos_notas: {
        Row: {
          cliente_contato: string | null
          cliente_id: string | null
          cliente_nome: string
          created_at: string
          honorario_calculo_id: string | null
          id: string
          lead_id: string | null
          modelo_ia: string | null
          notas_brutas: string
          operador_id: string
          organizacao_id: string | null
          origem: string
          relatorio_cliente: string | null
          relatorio_gerado_em: string | null
          status: string
          tipo_contato: string | null
          titulo: string | null
          updated_at: string
          visivel_cliente: boolean
        }
        Insert: {
          cliente_contato?: string | null
          cliente_id?: string | null
          cliente_nome: string
          created_at?: string
          honorario_calculo_id?: string | null
          id?: string
          lead_id?: string | null
          modelo_ia?: string | null
          notas_brutas?: string
          operador_id: string
          organizacao_id?: string | null
          origem?: string
          relatorio_cliente?: string | null
          relatorio_gerado_em?: string | null
          status?: string
          tipo_contato?: string | null
          titulo?: string | null
          updated_at?: string
          visivel_cliente?: boolean
        }
        Update: {
          cliente_contato?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          created_at?: string
          honorario_calculo_id?: string | null
          id?: string
          lead_id?: string | null
          modelo_ia?: string | null
          notas_brutas?: string
          operador_id?: string
          organizacao_id?: string | null
          origem?: string
          relatorio_cliente?: string | null
          relatorio_gerado_em?: string | null
          status?: string
          tipo_contato?: string | null
          titulo?: string | null
          updated_at?: string
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_notas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades_clientes: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          anexos_nomes: string[] | null
          anexos_urls: string[] | null
          banco: string | null
          created_at: string
          data_atividade: string | null
          deleted_at: string | null
          descricao: string
          id: string
          nome_cliente: string
          organizacao_id: string | null
          status_cliente: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          anexos_nomes?: string[] | null
          anexos_urls?: string[] | null
          banco?: string | null
          created_at?: string
          data_atividade?: string | null
          deleted_at?: string | null
          descricao: string
          id?: string
          nome_cliente: string
          organizacao_id?: string | null
          status_cliente?: string | null
          tipo?: string
          user_id: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          anexos_nomes?: string[] | null
          anexos_urls?: string[] | null
          banco?: string | null
          created_at?: string
          data_atividade?: string | null
          deleted_at?: string | null
          descricao?: string
          id?: string
          nome_cliente?: string
          organizacao_id?: string | null
          status_cliente?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_clientes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          campos_alterados: string[] | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          organizacao_id: string | null
          registro_id: string
          tabela: string
          user_id: string | null
        }
        Insert: {
          acao: string
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          organizacao_id?: string | null
          registro_id: string
          tabela: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          campos_alterados?: string[] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          organizacao_id?: string | null
          registro_id?: string
          tabela?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      avenca_valores: {
        Row: {
          avenca_id: string
          organizacao_id: string
          updated_at: string
          updated_by: string | null
          valor_mensal: number
        }
        Insert: {
          avenca_id: string
          organizacao_id: string
          updated_at?: string
          updated_by?: string | null
          valor_mensal: number
        }
        Update: {
          avenca_id?: string
          organizacao_id?: string
          updated_at?: string
          updated_by?: string | null
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "avenca_valores_avenca_id_fkey"
            columns: ["avenca_id"]
            isOneToOne: true
            referencedRelation: "avencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avenca_valores_avenca_id_fkey"
            columns: ["avenca_id"]
            isOneToOne: true
            referencedRelation: "portal_empresa_plano_view"
            referencedColumns: ["avenca_id"]
          },
        ]
      }
      avencas: {
        Row: {
          created_at: string
          deleted_at: string | null
          dia_vencimento: number | null
          empresa_id: string
          escopo_areas: string[]
          id: string
          observacoes: string | null
          organizacao_id: string
          reajuste_indice: string | null
          reajuste_proximo: string | null
          responsavel_id: string | null
          status: string
          titulo: string | null
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          dia_vencimento?: number | null
          empresa_id: string
          escopo_areas?: string[]
          id?: string
          observacoes?: string | null
          organizacao_id: string
          reajuste_indice?: string | null
          reajuste_proximo?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string | null
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          dia_vencimento?: number | null
          empresa_id?: string
          escopo_areas?: string[]
          id?: string
          observacoes?: string | null
          organizacao_id?: string
          reajuste_indice?: string | null
          reajuste_proximo?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string | null
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avencas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          categoria: string
          created_at: string
          descricao: string
          id: string
          pagina_url: string | null
          prioridade: string
          screenshot_url: string | null
          status: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          descricao: string
          id?: string
          pagina_url?: string | null
          prioridade?: string
          screenshot_url?: string | null
          status?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string
          id?: string
          pagina_url?: string | null
          prioridade?: string
          screenshot_url?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      carteira_responsaveis: {
        Row: {
          ativo: boolean
          created_at: string
          nome_curto: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          nome_curto: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          nome_curto?: string
          user_id?: string
        }
        Relationships: []
      }
      causa_notas: {
        Row: {
          autor_id: string | null
          causa_id: string
          conteudo: string
          created_at: string
          id: string
          organizacao_id: string
        }
        Insert: {
          autor_id?: string | null
          causa_id: string
          conteudo: string
          created_at?: string
          id?: string
          organizacao_id: string
        }
        Update: {
          autor_id?: string | null
          causa_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "causa_notas_causa_id_fkey"
            columns: ["causa_id"]
            isOneToOne: false
            referencedRelation: "causas_avulsas"
            referencedColumns: ["id"]
          },
        ]
      }
      causas_avulsas: {
        Row: {
          cliente_contato: string | null
          cliente_documento: string | null
          cliente_nome: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          id: string
          materia: string
          numero_processo: string | null
          organizacao_id: string
          parte_contraria: string | null
          prazo: string | null
          responsavel_id: string | null
          status: string
          titulo: string
          updated_at: string
          valor_causa: number | null
        }
        Insert: {
          cliente_contato?: string | null
          cliente_documento?: string | null
          cliente_nome: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          materia?: string
          numero_processo?: string | null
          organizacao_id: string
          parte_contraria?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
          valor_causa?: number | null
        }
        Update: {
          cliente_contato?: string | null
          cliente_documento?: string | null
          cliente_nome?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          materia?: string
          numero_processo?: string | null
          organizacao_id?: string
          parte_contraria?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          valor_causa?: number | null
        }
        Relationships: []
      }
      certificados_digitais: {
        Row: {
          ativo: boolean
          created_at: string
          emissor: string | null
          id: string
          nome_arquivo: string
          storage_path: string
          titular_cpf: string | null
          titular_nome: string | null
          updated_at: string
          user_id: string
          validade_fim: string | null
          validade_inicio: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          emissor?: string | null
          id?: string
          nome_arquivo: string
          storage_path: string
          titular_cpf?: string | null
          titular_nome?: string | null
          updated_at?: string
          user_id: string
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          emissor?: string | null
          id?: string
          nome_arquivo?: string
          storage_path?: string
          titular_cpf?: string | null
          titular_nome?: string | null
          updated_at?: string
          user_id?: string
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Relationships: []
      }
      cliente_banco_escopo: {
        Row: {
          banco: string
          cliente_id: string
          created_at: string
          created_by: string | null
          definido_em: string | null
          definido_nome: string | null
          definido_por: string | null
          escopo: string
          id: string
          observacao: string | null
          organizacao_id: string
          origem: string | null
          pendencia_comercial: boolean
          pendencia_resolvida_em: string | null
          pendencia_resolvida_por: string | null
          pendencia_texto: string | null
          updated_at: string
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          banco: string
          cliente_id: string
          created_at?: string
          created_by?: string | null
          definido_em?: string | null
          definido_nome?: string | null
          definido_por?: string | null
          escopo?: string
          id?: string
          observacao?: string | null
          organizacao_id: string
          origem?: string | null
          pendencia_comercial?: boolean
          pendencia_resolvida_em?: string | null
          pendencia_resolvida_por?: string | null
          pendencia_texto?: string | null
          updated_at?: string
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          banco?: string
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          definido_em?: string | null
          definido_nome?: string | null
          definido_por?: string | null
          escopo?: string
          id?: string
          observacao?: string | null
          organizacao_id?: string
          origem?: string | null
          pendencia_comercial?: boolean
          pendencia_resolvida_em?: string | null
          pendencia_resolvida_por?: string | null
          pendencia_texto?: string | null
          updated_at?: string
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_banco_escopo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_banco_escopo_historico: {
        Row: {
          alterado_nome: string | null
          alterado_por: string | null
          banco: string
          cliente_id: string
          created_at: string
          escopo_anterior: string | null
          escopo_novo: string
          id: string
          motivo: string | null
          organizacao_id: string
          origem: string | null
        }
        Insert: {
          alterado_nome?: string | null
          alterado_por?: string | null
          banco: string
          cliente_id: string
          created_at?: string
          escopo_anterior?: string | null
          escopo_novo: string
          id?: string
          motivo?: string | null
          organizacao_id: string
          origem?: string | null
        }
        Update: {
          alterado_nome?: string | null
          alterado_por?: string | null
          banco?: string
          cliente_id?: string
          created_at?: string
          escopo_anterior?: string | null
          escopo_novo?: string
          id?: string
          motivo?: string | null
          organizacao_id?: string
          origem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_banco_escopo_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_execucoes: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          encerrado_em: string | null
          encerrado_por: string | null
          grupo: string | null
          id: string
          motivo_encerramento: string | null
          numero_processo: string | null
          onboarding_id: string | null
          operacao_id: string | null
          organizacao_id: string | null
          sistema: string | null
          status: string
          tipo: string
          updated_at: string
          vara: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          grupo?: string | null
          id?: string
          motivo_encerramento?: string | null
          numero_processo?: string | null
          onboarding_id?: string | null
          operacao_id?: string | null
          organizacao_id?: string | null
          sistema?: string | null
          status?: string
          tipo: string
          updated_at?: string
          vara?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          encerrado_em?: string | null
          encerrado_por?: string | null
          grupo?: string | null
          id?: string
          motivo_encerramento?: string | null
          numero_processo?: string | null
          onboarding_id?: string | null
          operacao_id?: string | null
          organizacao_id?: string | null
          sistema?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_execucoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_execucoes_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "pos_venda_onboardings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_execucoes_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_portal_usuarios: {
        Row: {
          ativo: boolean
          cliente_id: string
          convidado_por: string | null
          created_at: string
          id: string
          organizacao_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cliente_id: string
          convidado_por?: string | null
          created_at?: string
          id?: string
          organizacao_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          convidado_por?: string | null
          created_at?: string
          id?: string
          organizacao_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_portal_usuarios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_portal_usuarios_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          advbox_customers_id: string | null
          aguardando_distribuicao: boolean
          area_hectares: number | null
          base_historica_advbox: boolean
          cadastrado_em: string
          cadastrado_por: string | null
          cep: string | null
          cpf_cnpj: string | null
          cpf_observacao: string | null
          cpf_origem: string | null
          cpf_origem_em: string | null
          created_at: string
          cultura_principal: string | null
          deleted_at: string | null
          email: string | null
          encerramento_comunicado_arquivo: string | null
          encerramento_comunicado_canal: string | null
          encerramento_comunicado_em: string | null
          encerramento_comunicado_por: string | null
          encerramento_comunicado_registrado_em: string | null
          endereco: string | null
          estado_civil: string | null
          grafias_alternativas: string[] | null
          grupo: string | null
          id: string
          municipio: string | null
          nacionalidade: string | null
          nome: string
          nome_propriedade: string | null
          nps: number | null
          observacoes: string | null
          organizacao_id: string | null
          orgao_emissor: string | null
          profissao: string | null
          responsavel_pos_venda: string | null
          rg: string | null
          risco: string | null
          situacao: string
          situacao_alterada_em: string | null
          situacao_alterada_por: string | null
          situacao_motivo: string | null
          status_adimplencia: string
          telefone: string | null
          triado_em: string | null
          triagem_origem: string | null
          uf: string | null
          updated_at: string
          user_id: string
          vip: boolean
        }
        Insert: {
          advbox_customers_id?: string | null
          aguardando_distribuicao?: boolean
          area_hectares?: number | null
          base_historica_advbox?: boolean
          cadastrado_em?: string
          cadastrado_por?: string | null
          cep?: string | null
          cpf_cnpj?: string | null
          cpf_observacao?: string | null
          cpf_origem?: string | null
          cpf_origem_em?: string | null
          created_at?: string
          cultura_principal?: string | null
          deleted_at?: string | null
          email?: string | null
          encerramento_comunicado_arquivo?: string | null
          encerramento_comunicado_canal?: string | null
          encerramento_comunicado_em?: string | null
          encerramento_comunicado_por?: string | null
          encerramento_comunicado_registrado_em?: string | null
          endereco?: string | null
          estado_civil?: string | null
          grafias_alternativas?: string[] | null
          grupo?: string | null
          id?: string
          municipio?: string | null
          nacionalidade?: string | null
          nome: string
          nome_propriedade?: string | null
          nps?: number | null
          observacoes?: string | null
          organizacao_id?: string | null
          orgao_emissor?: string | null
          profissao?: string | null
          responsavel_pos_venda?: string | null
          rg?: string | null
          risco?: string | null
          situacao?: string
          situacao_alterada_em?: string | null
          situacao_alterada_por?: string | null
          situacao_motivo?: string | null
          status_adimplencia?: string
          telefone?: string | null
          triado_em?: string | null
          triagem_origem?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
          vip?: boolean
        }
        Update: {
          advbox_customers_id?: string | null
          aguardando_distribuicao?: boolean
          area_hectares?: number | null
          base_historica_advbox?: boolean
          cadastrado_em?: string
          cadastrado_por?: string | null
          cep?: string | null
          cpf_cnpj?: string | null
          cpf_observacao?: string | null
          cpf_origem?: string | null
          cpf_origem_em?: string | null
          created_at?: string
          cultura_principal?: string | null
          deleted_at?: string | null
          email?: string | null
          encerramento_comunicado_arquivo?: string | null
          encerramento_comunicado_canal?: string | null
          encerramento_comunicado_em?: string | null
          encerramento_comunicado_por?: string | null
          encerramento_comunicado_registrado_em?: string | null
          endereco?: string | null
          estado_civil?: string | null
          grafias_alternativas?: string[] | null
          grupo?: string | null
          id?: string
          municipio?: string | null
          nacionalidade?: string | null
          nome?: string
          nome_propriedade?: string | null
          nps?: number | null
          observacoes?: string | null
          organizacao_id?: string | null
          orgao_emissor?: string | null
          profissao?: string | null
          responsavel_pos_venda?: string | null
          rg?: string | null
          risco?: string | null
          situacao?: string
          situacao_alterada_em?: string | null
          situacao_alterada_por?: string | null
          situacao_motivo?: string | null
          status_adimplencia?: string
          telefone?: string | null
          triado_em?: string | null
          triagem_origem?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
          vip?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clientes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_atividades: {
        Row: {
          created_at: string
          data_atividade: string
          descricao: string | null
          duracao_minutos: number | null
          id: string
          lead_id: string
          organizacao_id: string
          responsavel_id: string
          resultado: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          data_atividade?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          lead_id: string
          organizacao_id: string
          responsavel_id: string
          resultado?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          data_atividade?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          lead_id?: string
          organizacao_id?: string
          responsavel_id?: string
          resultado?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "comercial_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "comercial_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comercial_atividades_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_leads: {
        Row: {
          created_at: string
          data_conversao_sql: string | null
          data_entrada: string
          data_fechamento: string | null
          data_proposta: string | null
          data_reuniao: string | null
          email: string | null
          empresa: string | null
          etapa_funil: string
          id: string
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          organizacao_id: string
          origem: string
          responsavel_id: string
          telefone: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string
          data_conversao_sql?: string | null
          data_entrada?: string
          data_fechamento?: string | null
          data_proposta?: string | null
          data_reuniao?: string | null
          email?: string | null
          empresa?: string | null
          etapa_funil?: string
          id?: string
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          organizacao_id: string
          origem?: string
          responsavel_id: string
          telefone?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string
          data_conversao_sql?: string | null
          data_entrada?: string
          data_fechamento?: string | null
          data_proposta?: string | null
          data_reuniao?: string | null
          email?: string | null
          empresa?: string | null
          etapa_funil?: string
          id?: string
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          organizacao_id?: string
          origem?: string
          responsavel_id?: string
          telefone?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comercial_leads_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      comercial_metas: {
        Row: {
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          organizacao_id: string
          periodo_fim: string
          periodo_inicio: string
          responsavel_id: string
          status: string
          tipo_meta: string
          titulo: string
          updated_at: string
          valor_alvo: number
          valor_atual: number
        }
        Insert: {
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          organizacao_id: string
          periodo_fim: string
          periodo_inicio?: string
          responsavel_id: string
          status?: string
          tipo_meta?: string
          titulo: string
          updated_at?: string
          valor_alvo?: number
          valor_atual?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          organizacao_id?: string
          periodo_fim?: string
          periodo_inicio?: string
          responsavel_id?: string
          status?: string
          tipo_meta?: string
          titulo?: string
          updated_at?: string
          valor_alvo?: number
          valor_atual?: number
        }
        Relationships: [
          {
            foreignKeyName: "comercial_metas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_demandas: {
        Row: {
          aberta_por: string | null
          area: string | null
          assunto: string
          avenca_id: string | null
          concluida_em: string | null
          contato_id: string | null
          created_at: string
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          organizacao_id: string
          origem: string
          prazo: string | null
          prioridade: string
          responsavel_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aberta_por?: string | null
          area?: string | null
          assunto: string
          avenca_id?: string | null
          concluida_em?: string | null
          contato_id?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          organizacao_id: string
          origem?: string
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aberta_por?: string | null
          area?: string | null
          assunto?: string
          avenca_id?: string | null
          concluida_em?: string | null
          contato_id?: string | null
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          organizacao_id?: string
          origem?: string
          prazo?: string | null
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_demandas_avenca_id_fkey"
            columns: ["avenca_id"]
            isOneToOne: false
            referencedRelation: "avencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultoria_demandas_avenca_id_fkey"
            columns: ["avenca_id"]
            isOneToOne: false
            referencedRelation: "portal_empresa_plano_view"
            referencedColumns: ["avenca_id"]
          },
          {
            foreignKeyName: "consultoria_demandas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "empresa_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultoria_demandas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_onboarding: {
        Row: {
          avenca_id: string | null
          concluido_em: string | null
          created_at: string
          deleted_at: string | null
          empresa_id: string
          id: string
          iniciado_em: string
          organizacao_id: string
          responsavel_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avenca_id?: string | null
          concluido_em?: string | null
          created_at?: string
          deleted_at?: string | null
          empresa_id: string
          id?: string
          iniciado_em?: string
          organizacao_id: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avenca_id?: string | null
          concluido_em?: string | null
          created_at?: string
          deleted_at?: string | null
          empresa_id?: string
          id?: string
          iniciado_em?: string
          organizacao_id?: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_onboarding_avenca_id_fkey"
            columns: ["avenca_id"]
            isOneToOne: false
            referencedRelation: "avencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultoria_onboarding_avenca_id_fkey"
            columns: ["avenca_id"]
            isOneToOne: false
            referencedRelation: "portal_empresa_plano_view"
            referencedColumns: ["avenca_id"]
          },
          {
            foreignKeyName: "consultoria_onboarding_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_onboarding_itens: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          created_at: string
          id: string
          observacao: string | null
          onboarding_id: string
          ordem: number
          organizacao_id: string
          titulo: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          onboarding_id: string
          ordem?: number
          organizacao_id: string
          titulo: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          onboarding_id?: string
          ordem?: number
          organizacao_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_onboarding_itens_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "consultoria_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_propostas: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          empresa_id: string | null
          id: string
          inputs: Json
          observacoes: string | null
          organizacao_id: string
          prospect_nome: string | null
          resultado: Json
          status: string
          titulo: string
          updated_at: string
          valor_sugerido: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string | null
          id?: string
          inputs?: Json
          observacoes?: string | null
          organizacao_id: string
          prospect_nome?: string | null
          resultado?: Json
          status?: string
          titulo: string
          updated_at?: string
          valor_sugerido?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          empresa_id?: string | null
          id?: string
          inputs?: Json
          observacoes?: string | null
          organizacao_id?: string
          prospect_nome?: string | null
          resultado?: Json
          status?: string
          titulo?: string
          updated_at?: string
          valor_sugerido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultoria_propostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      consultoria_simulacoes: {
        Row: {
          cliente_nome: string
          created_at: string
          fator_complexidade: number
          honorario_exito_estimado: number | null
          id: string
          operador_id: string
          organizacao_id: string | null
          plano: string
          status_verificacao: string
          tipo_cliente: string
          valor_base: number
          valor_credito_cobranca: number | null
          valor_mensalidade_final: number
        }
        Insert: {
          cliente_nome: string
          created_at?: string
          fator_complexidade?: number
          honorario_exito_estimado?: number | null
          id?: string
          operador_id: string
          organizacao_id?: string | null
          plano: string
          status_verificacao?: string
          tipo_cliente: string
          valor_base: number
          valor_credito_cobranca?: number | null
          valor_mensalidade_final: number
        }
        Update: {
          cliente_nome?: string
          created_at?: string
          fator_complexidade?: number
          honorario_exito_estimado?: number | null
          id?: string
          operador_id?: string
          organizacao_id?: string | null
          plano?: string
          status_verificacao?: string
          tipo_cliente?: string
          valor_base?: number
          valor_credito_cobranca?: number | null
          valor_mensalidade_final?: number
        }
        Relationships: []
      }
      contratos_vencimentos: {
        Row: {
          banco: string | null
          canal_notificacao: string | null
          cliente_id: string | null
          created_at: string
          data_limite_protocolo: string | null
          data_notificacao: string | null
          deleted_at: string | null
          id: string
          laudo_id: string | null
          motivo_resolucao: string | null
          nome_cliente: string
          notificado_antes_vencimento: boolean | null
          numero_contrato: string | null
          observacoes: string | null
          organizacao_id: string | null
          parcelas_vencidas: boolean | null
          possui_laudo: boolean | null
          primeiro_vencimento: string | null
          protocolo_realizado: boolean | null
          resolvido: boolean
          responsavel_gestao: string | null
          status_prazo: string | null
          updated_at: string
          user_id: string
          valor_parcela: number | null
          valor_total_operacao: number | null
          vencimento_proxima_parcela: string | null
          vencimento_ultima_parcela: string | null
          visivel_cliente: boolean
        }
        Insert: {
          banco?: string | null
          canal_notificacao?: string | null
          cliente_id?: string | null
          created_at?: string
          data_limite_protocolo?: string | null
          data_notificacao?: string | null
          deleted_at?: string | null
          id?: string
          laudo_id?: string | null
          motivo_resolucao?: string | null
          nome_cliente: string
          notificado_antes_vencimento?: boolean | null
          numero_contrato?: string | null
          observacoes?: string | null
          organizacao_id?: string | null
          parcelas_vencidas?: boolean | null
          possui_laudo?: boolean | null
          primeiro_vencimento?: string | null
          protocolo_realizado?: boolean | null
          resolvido?: boolean
          responsavel_gestao?: string | null
          status_prazo?: string | null
          updated_at?: string
          user_id: string
          valor_parcela?: number | null
          valor_total_operacao?: number | null
          vencimento_proxima_parcela?: string | null
          vencimento_ultima_parcela?: string | null
          visivel_cliente?: boolean
        }
        Update: {
          banco?: string | null
          canal_notificacao?: string | null
          cliente_id?: string | null
          created_at?: string
          data_limite_protocolo?: string | null
          data_notificacao?: string | null
          deleted_at?: string | null
          id?: string
          laudo_id?: string | null
          motivo_resolucao?: string | null
          nome_cliente?: string
          notificado_antes_vencimento?: boolean | null
          numero_contrato?: string | null
          observacoes?: string | null
          organizacao_id?: string | null
          parcelas_vencidas?: boolean | null
          possui_laudo?: boolean | null
          primeiro_vencimento?: string | null
          protocolo_realizado?: boolean | null
          resolvido?: boolean
          responsavel_gestao?: string | null
          status_prazo?: string | null
          updated_at?: string
          user_id?: string
          valor_parcela?: number | null
          valor_total_operacao?: number | null
          vencimento_proxima_parcela?: string | null
          vencimento_ultima_parcela?: string | null
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contratos_vencimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_vencimentos_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "laudos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_vencimentos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_advbox_usuarios: {
        Row: {
          advbox_email: string | null
          advbox_nome: string | null
          advbox_user_id: string
          atualizado_em: string
          id: string
          organizacao_id: string
          origem: string | null
          user_id: string | null
        }
        Insert: {
          advbox_email?: string | null
          advbox_nome?: string | null
          advbox_user_id: string
          atualizado_em?: string
          id?: string
          organizacao_id: string
          origem?: string | null
          user_id?: string | null
        }
        Update: {
          advbox_email?: string | null
          advbox_nome?: string | null
          advbox_user_id?: string
          atualizado_em?: string
          id?: string
          organizacao_id?: string
          origem?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_advbox_usuarios_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_conferencia_advbox: {
        Row: {
          chave: string
          criado_em: string
          data: string | null
          id: string
          lado: string
          numero_cnj: string
          organizacao_id: string
          processo_judicial_id: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          trecho: string | null
        }
        Insert: {
          chave: string
          criado_em?: string
          data?: string | null
          id?: string
          lado: string
          numero_cnj: string
          organizacao_id: string
          processo_judicial_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          trecho?: string | null
        }
        Update: {
          chave?: string
          criado_em?: string
          data?: string | null
          id?: string
          lado?: string
          numero_cnj?: string
          organizacao_id?: string
          processo_judicial_id?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          trecho?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_conferencia_advbox_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controladoria_conferencia_advbox_processo_judicial_id_fkey"
            columns: ["processo_judicial_id"]
            isOneToOne: false
            referencedRelation: "processos_judiciais"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_conferencia_processos: {
        Row: {
          conferido_em: string
          erro: string | null
          organizacao_id: string
          pares: number
          prioridade: string | null
          processo_judicial_id: string
          so_advbox: number
          so_app: number
        }
        Insert: {
          conferido_em?: string
          erro?: string | null
          organizacao_id: string
          pares?: number
          prioridade?: string | null
          processo_judicial_id: string
          so_advbox?: number
          so_app?: number
        }
        Update: {
          conferido_em?: string
          erro?: string | null
          organizacao_id?: string
          pares?: number
          prioridade?: string | null
          processo_judicial_id?: string
          so_advbox?: number
          so_app?: number
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_conferencia_processos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controladoria_conferencia_processos_processo_judicial_id_fkey"
            columns: ["processo_judicial_id"]
            isOneToOne: false
            referencedRelation: "processos_judiciais"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_d5_itens: {
        Row: {
          cliente: string | null
          created_at: string
          d_n: number | null
          id: string
          id_externo: string | null
          organizacao_id: string
          origem: string
          prazo: string | null
          processo: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          snapshot_id: string
          titulo: string | null
          user_id: string | null
          vencida: boolean
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          d_n?: number | null
          id?: string
          id_externo?: string | null
          organizacao_id: string
          origem: string
          prazo?: string | null
          processo?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          snapshot_id: string
          titulo?: string | null
          user_id?: string | null
          vencida?: boolean
        }
        Update: {
          cliente?: string | null
          created_at?: string
          d_n?: number | null
          id?: string
          id_externo?: string | null
          organizacao_id?: string
          origem?: string
          prazo?: string | null
          processo?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          snapshot_id?: string
          titulo?: string | null
          user_id?: string | null
          vencida?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_d5_itens_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controladoria_d5_itens_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "controladoria_d5_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_d5_snapshots: {
        Row: {
          d0: string
          data_ref: string
          gerado_em: string
          html: string | null
          id: string
          janela_fim: string
          organizacao_id: string
          totais: Json
          total_janela: number
          total_vencidas: number
        }
        Insert: {
          d0: string
          data_ref: string
          gerado_em?: string
          html?: string | null
          id?: string
          janela_fim: string
          organizacao_id: string
          totais?: Json
          total_janela?: number
          total_vencidas?: number
        }
        Update: {
          d0?: string
          data_ref?: string
          gerado_em?: string
          html?: string | null
          id?: string
          janela_fim?: string
          organizacao_id?: string
          totais?: Json
          total_janela?: number
          total_vencidas?: number
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_d5_snapshots_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_datajud_movimentos: {
        Row: {
          carga_inicial: boolean
          codigo: number
          complementos: Json | null
          created_at: string
          data_hora: string
          id: string
          nome: string | null
          numero_cnj: string
          organizacao_id: string
          visto_em: string | null
          visto_por: string | null
        }
        Insert: {
          carga_inicial?: boolean
          codigo?: number
          complementos?: Json | null
          created_at?: string
          data_hora: string
          id?: string
          nome?: string | null
          numero_cnj: string
          organizacao_id: string
          visto_em?: string | null
          visto_por?: string | null
        }
        Update: {
          carga_inicial?: boolean
          codigo?: number
          complementos?: Json | null
          created_at?: string
          data_hora?: string
          id?: string
          nome?: string | null
          numero_cnj?: string
          organizacao_id?: string
          visto_em?: string | null
          visto_por?: string | null
        }
        Relationships: []
      }
      controladoria_datajud_processos: {
        Row: {
          assuntos: Json | null
          classe: string | null
          cliente_id: string | null
          consultado_em: string | null
          created_at: string
          dados_brutos: Json | null
          data_ajuizamento: string | null
          erro: string | null
          frequencia: string
          grau: string | null
          id: string
          nao_encontrado: boolean
          numero_cnj: string
          organizacao_id: string
          orgao_julgador: string | null
          origem: string
          processo_judicial_id: string | null
          proxima_consulta_em: string
          tribunal: string | null
        }
        Insert: {
          assuntos?: Json | null
          classe?: string | null
          cliente_id?: string | null
          consultado_em?: string | null
          created_at?: string
          dados_brutos?: Json | null
          data_ajuizamento?: string | null
          erro?: string | null
          frequencia?: string
          grau?: string | null
          id?: string
          nao_encontrado?: boolean
          numero_cnj: string
          organizacao_id: string
          orgao_julgador?: string | null
          origem?: string
          processo_judicial_id?: string | null
          proxima_consulta_em?: string
          tribunal?: string | null
        }
        Update: {
          assuntos?: Json | null
          classe?: string | null
          cliente_id?: string | null
          consultado_em?: string | null
          created_at?: string
          dados_brutos?: Json | null
          data_ajuizamento?: string | null
          erro?: string | null
          frequencia?: string
          grau?: string | null
          id?: string
          nao_encontrado?: boolean
          numero_cnj?: string
          organizacao_id?: string
          orgao_julgador?: string | null
          origem?: string
          processo_judicial_id?: string | null
          proxima_consulta_em?: string
          tribunal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_datajud_processos_processo_judicial_id_fkey"
            columns: ["processo_judicial_id"]
            isOneToOne: false
            referencedRelation: "processos_judiciais"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_execucoes: {
        Row: {
          detalhes: Json | null
          erro: string | null
          fim: string | null
          funcao: string
          id: string
          inicio: string
          novas: number | null
          organizacao_id: string | null
          origem: string | null
          total: number | null
        }
        Insert: {
          detalhes?: Json | null
          erro?: string | null
          fim?: string | null
          funcao: string
          id?: string
          inicio?: string
          novas?: number | null
          organizacao_id?: string | null
          origem?: string | null
          total?: number | null
        }
        Update: {
          detalhes?: Json | null
          erro?: string | null
          fim?: string | null
          funcao?: string
          id?: string
          inicio?: string
          novas?: number | null
          organizacao_id?: string | null
          origem?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_execucoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_feriados_forenses: {
        Row: {
          ativo: boolean
          created_at: string
          data: string
          id: string
          nome: string
          organizacao_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data: string
          id?: string
          nome: string
          organizacao_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data?: string
          id?: string
          nome?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_feriados_forenses_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_membros: {
        Row: {
          created_at: string
          id: string
          organizacao_id: string
          papel: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organizacao_id: string
          papel?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organizacao_id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_membros_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_monitor_execucoes: {
        Row: {
          concluido_em: string | null
          erros: Json | null
          id: string
          iniciado_em: string
          modo: string
          organizacao_id: string
          origem: string | null
          processados: number
          requisicoes: number
          resumo: Json | null
          status: string
          tipo: string
        }
        Insert: {
          concluido_em?: string | null
          erros?: Json | null
          id?: string
          iniciado_em?: string
          modo?: string
          organizacao_id: string
          origem?: string | null
          processados?: number
          requisicoes?: number
          resumo?: Json | null
          status?: string
          tipo: string
        }
        Update: {
          concluido_em?: string | null
          erros?: Json | null
          id?: string
          iniciado_em?: string
          modo?: string
          organizacao_id?: string
          origem?: string | null
          processados?: number
          requisicoes?: number
          resumo?: Json | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      controladoria_oabs: {
        Row: {
          advogado_nome: string | null
          ativo: boolean
          carga_inicial_feita: boolean
          created_at: string
          id: string
          nome_busca: string | null
          numero: string
          organizacao_id: string
          responsavel_id: string | null
          uf: string
          ultima_captura: string | null
          user_id: string | null
        }
        Insert: {
          advogado_nome?: string | null
          ativo?: boolean
          carga_inicial_feita?: boolean
          created_at?: string
          id?: string
          nome_busca?: string | null
          numero: string
          organizacao_id: string
          responsavel_id?: string | null
          uf: string
          ultima_captura?: string | null
          user_id?: string | null
        }
        Update: {
          advogado_nome?: string | null
          ativo?: boolean
          carga_inicial_feita?: boolean
          created_at?: string
          id?: string
          nome_busca?: string | null
          numero?: string
          organizacao_id?: string
          responsavel_id?: string | null
          uf?: string
          ultima_captura?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_oabs_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_radar_buscas: {
        Row: {
          cliente_id: string
          nome_comum: boolean
          organizacao_id: string
          ultima_busca_em: string | null
          ultima_execucao_em: string | null
        }
        Insert: {
          cliente_id: string
          nome_comum?: boolean
          organizacao_id: string
          ultima_busca_em?: string | null
          ultima_execucao_em?: string | null
        }
        Update: {
          cliente_id?: string
          nome_comum?: boolean
          organizacao_id?: string
          ultima_busca_em?: string | null
          ultima_execucao_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_radar_buscas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_radar_decisoes: {
        Row: {
          cliente_id: string
          decidido_em: string
          decidido_por: string | null
          decisao: string
          id: string
          numero_processo: string
          organizacao_id: string
        }
        Insert: {
          cliente_id: string
          decidido_em?: string
          decidido_por?: string | null
          decisao: string
          id?: string
          numero_processo: string
          organizacao_id: string
        }
        Update: {
          cliente_id?: string
          decidido_em?: string
          decidido_por?: string | null
          decisao?: string
          id?: string
          numero_processo?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_radar_decisoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_radar_resultados: {
        Row: {
          avisado_em: string | null
          classe: string | null
          cliente_autor: boolean
          cliente_id: string
          created_at: string
          data_disponibilizacao: string | null
          destaque: boolean
          djen_id: number | null
          faixa: string
          id: string
          link: string | null
          nota: number
          numero_processo: string
          numero_processo_mascara: string | null
          organizacao_id: string
          orgao: string | null
          polos: Json | null
          simulacao: boolean
          sinais: Json | null
          status: string
          trecho: string | null
          tribunal: string | null
          updated_at: string
        }
        Insert: {
          avisado_em?: string | null
          classe?: string | null
          cliente_autor?: boolean
          cliente_id: string
          created_at?: string
          data_disponibilizacao?: string | null
          destaque?: boolean
          djen_id?: number | null
          faixa?: string
          id?: string
          link?: string | null
          nota?: number
          numero_processo: string
          numero_processo_mascara?: string | null
          organizacao_id: string
          orgao?: string | null
          polos?: Json | null
          simulacao?: boolean
          sinais?: Json | null
          status?: string
          trecho?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Update: {
          avisado_em?: string | null
          classe?: string | null
          cliente_autor?: boolean
          cliente_id?: string
          created_at?: string
          data_disponibilizacao?: string | null
          destaque?: boolean
          djen_id?: number | null
          faixa?: string
          id?: string
          link?: string | null
          nota?: number
          numero_processo?: string
          numero_processo_mascara?: string | null
          organizacao_id?: string
          orgao?: string | null
          polos?: Json | null
          simulacao?: boolean
          sinais?: Json | null
          status?: string
          trecho?: string | null
          tribunal?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_radar_resultados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_triagem_lote_itens: {
        Row: {
          anterior: Json
          comunicacao_id: string
          id: string
          lote_id: string
          organizacao_id: string
          tarefa_criada_id: string | null
        }
        Insert: {
          anterior: Json
          comunicacao_id: string
          id?: string
          lote_id: string
          organizacao_id: string
          tarefa_criada_id?: string | null
        }
        Update: {
          anterior?: Json
          comunicacao_id?: string
          id?: string
          lote_id?: string
          organizacao_id?: string
          tarefa_criada_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controladoria_triagem_lote_itens_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "controladoria_triagem_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      controladoria_triagem_lotes: {
        Row: {
          acao: string
          created_at: string
          desfeito_em: string | null
          desfeito_por: string | null
          id: string
          observacao: string | null
          organizacao_id: string
          quantidade: number
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          desfeito_em?: string | null
          desfeito_por?: string | null
          id?: string
          observacao?: string | null
          organizacao_id: string
          quantidade?: number
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          desfeito_em?: string | null
          desfeito_por?: string | null
          id?: string
          observacao?: string | null
          organizacao_id?: string
          quantidade?: number
          user_id?: string | null
        }
        Relationships: []
      }
      conversa_membros: {
        Row: {
          conversa_id: string
          entrou_em: string
          id: string
          papel: string
          saiu_em: string | null
          ultima_leitura_em: string
          user_id: string
        }
        Insert: {
          conversa_id: string
          entrou_em?: string
          id?: string
          papel?: string
          saiu_em?: string | null
          ultima_leitura_em?: string
          user_id: string
        }
        Update: {
          conversa_id?: string
          entrou_em?: string
          id?: string
          papel?: string
          saiu_em?: string | null
          ultima_leitura_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversa_membros_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          cliente_id: string | null
          created_at: string
          criada_por: string
          id: string
          laudo_id: string | null
          organizacao_id: string
          processo_id: string | null
          tipo: string
          titulo: string | null
          ultima_mensagem_em: string
          ultima_mensagem_preview: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          criada_por: string
          id?: string
          laudo_id?: string | null
          organizacao_id: string
          processo_id?: string | null
          tipo?: string
          titulo?: string | null
          ultima_mensagem_em?: string
          ultima_mensagem_preview?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          criada_por?: string
          id?: string
          laudo_id?: string | null
          organizacao_id?: string
          processo_id?: string | null
          tipo?: string
          titulo?: string | null
          ultima_mensagem_em?: string
          ultima_mensagem_preview?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dados_climaticos: {
        Row: {
          created_at: string
          dados: Json | null
          estacao_codigo: string | null
          estacao_nome: string | null
          id: string
          laudo_id: string
          municipio: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          uf: string | null
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          estacao_codigo?: string | null
          estacao_nome?: string | null
          id?: string
          laudo_id: string
          municipio?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          uf?: string | null
        }
        Update: {
          created_at?: string
          dados?: Json | null
          estacao_codigo?: string | null
          estacao_nome?: string | null
          id?: string
          laudo_id?: string
          municipio?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dados_climaticos_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "laudos"
            referencedColumns: ["id"]
          },
        ]
      }
      demanda_interacoes: {
        Row: {
          autor_id: string | null
          conteudo: string
          created_at: string
          demanda_id: string
          id: string
          organizacao_id: string
          tipo: string
          visivel_empresa: boolean
        }
        Insert: {
          autor_id?: string | null
          conteudo: string
          created_at?: string
          demanda_id: string
          id?: string
          organizacao_id: string
          tipo?: string
          visivel_empresa?: boolean
        }
        Update: {
          autor_id?: string | null
          conteudo?: string
          created_at?: string
          demanda_id?: string
          id?: string
          organizacao_id?: string
          tipo?: string
          visivel_empresa?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "demanda_interacoes_demanda_id_fkey"
            columns: ["demanda_id"]
            isOneToOne: false
            referencedRelation: "consultoria_demandas"
            referencedColumns: ["id"]
          },
        ]
      }
      djen_comunicacoes: {
        Row: {
          advbox_consultado_em: string | null
          advbox_lawsuit_id: string | null
          advbox_nao_cadastrado: boolean
          advbox_responsavel: string | null
          advbox_responsavel_id: string | null
          advogados: Json
          ativo: boolean | null
          aviso_suspensao: boolean
          capturada_por: string | null
          cliente_id: string | null
          created_at: string
          data_cancelamento: string | null
          data_disponibilizacao: string | null
          data_publicacao: string | null
          destinatarios: Json
          djen_id: number
          hash: string | null
          id: string
          inicio_prazo: string | null
          link: string | null
          meio: string | null
          nome_classe: string | null
          nome_orgao: string | null
          numero_processo: string | null
          numero_processo_mascara: string | null
          oab_id: string | null
          observacao: string | null
          organizacao_id: string
          polo_cliente: string | null
          prazo_dias: number | null
          prazo_fatal: string | null
          prazo_sugerido_dias: number | null
          prazo_sugerido_multiplo: boolean
          prazo_sugerido_trecho: string | null
          processo_judicial_id: string | null
          responsavel_id: string | null
          sigla_tribunal: string | null
          status: string | null
          status_triagem: string
          tarefa_id: string | null
          texto: string | null
          tipo_comunicacao: string | null
          triado_em: string | null
          triado_por: string | null
          updated_at: string
        }
        Insert: {
          advbox_consultado_em?: string | null
          advbox_lawsuit_id?: string | null
          advbox_nao_cadastrado?: boolean
          advbox_responsavel?: string | null
          advbox_responsavel_id?: string | null
          advogados?: Json
          ativo?: boolean | null
          aviso_suspensao?: boolean
          capturada_por?: string | null
          cliente_id?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          destinatarios?: Json
          djen_id: number
          hash?: string | null
          id?: string
          inicio_prazo?: string | null
          link?: string | null
          meio?: string | null
          nome_classe?: string | null
          nome_orgao?: string | null
          numero_processo?: string | null
          numero_processo_mascara?: string | null
          oab_id?: string | null
          observacao?: string | null
          organizacao_id: string
          polo_cliente?: string | null
          prazo_dias?: number | null
          prazo_fatal?: string | null
          prazo_sugerido_dias?: number | null
          prazo_sugerido_multiplo?: boolean
          prazo_sugerido_trecho?: string | null
          processo_judicial_id?: string | null
          responsavel_id?: string | null
          sigla_tribunal?: string | null
          status?: string | null
          status_triagem?: string
          tarefa_id?: string | null
          texto?: string | null
          tipo_comunicacao?: string | null
          triado_em?: string | null
          triado_por?: string | null
          updated_at?: string
        }
        Update: {
          advbox_consultado_em?: string | null
          advbox_lawsuit_id?: string | null
          advbox_nao_cadastrado?: boolean
          advbox_responsavel?: string | null
          advbox_responsavel_id?: string | null
          advogados?: Json
          ativo?: boolean | null
          aviso_suspensao?: boolean
          capturada_por?: string | null
          cliente_id?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_disponibilizacao?: string | null
          data_publicacao?: string | null
          destinatarios?: Json
          djen_id?: number
          hash?: string | null
          id?: string
          inicio_prazo?: string | null
          link?: string | null
          meio?: string | null
          nome_classe?: string | null
          nome_orgao?: string | null
          numero_processo?: string | null
          numero_processo_mascara?: string | null
          oab_id?: string | null
          observacao?: string | null
          organizacao_id?: string
          polo_cliente?: string | null
          prazo_dias?: number | null
          prazo_fatal?: string | null
          prazo_sugerido_dias?: number | null
          prazo_sugerido_multiplo?: boolean
          prazo_sugerido_trecho?: string | null
          processo_judicial_id?: string | null
          responsavel_id?: string | null
          sigla_tribunal?: string | null
          status?: string | null
          status_triagem?: string
          tarefa_id?: string | null
          texto?: string | null
          tipo_comunicacao?: string | null
          triado_em?: string | null
          triado_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "djen_comunicacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "djen_comunicacoes_oab_id_fkey"
            columns: ["oab_id"]
            isOneToOne: false
            referencedRelation: "controladoria_oabs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "djen_comunicacoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "djen_comunicacoes_processo_judicial_id_fkey"
            columns: ["processo_judicial_id"]
            isOneToOne: false
            referencedRelation: "processos_judiciais"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          laudo_id: string
          nome_arquivo: string
          organizacao_id: string | null
          storage_path: string
          tamanho_bytes: number | null
          user_id: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          laudo_id: string
          nome_arquivo: string
          organizacao_id?: string | null
          storage_path: string
          tamanho_bytes?: number | null
          user_id: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          laudo_id?: string
          nome_arquivo?: string
          organizacao_id?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "laudos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_acordos: {
        Row: {
          condicoes: string | null
          created_at: string
          created_by: string | null
          data_acordo: string | null
          deleted_at: string | null
          demanda_externa_id: string
          empresa_id: string
          id: string
          observacoes: string | null
          organizacao_id: string
          status: string
          updated_at: string
          valor_acordo: number | null
        }
        Insert: {
          condicoes?: string | null
          created_at?: string
          created_by?: string | null
          data_acordo?: string | null
          deleted_at?: string | null
          demanda_externa_id: string
          empresa_id: string
          id?: string
          observacoes?: string | null
          organizacao_id: string
          status?: string
          updated_at?: string
          valor_acordo?: number | null
        }
        Update: {
          condicoes?: string | null
          created_at?: string
          created_by?: string | null
          data_acordo?: string | null
          deleted_at?: string | null
          demanda_externa_id?: string
          empresa_id?: string
          id?: string
          observacoes?: string | null
          organizacao_id?: string
          status?: string
          updated_at?: string
          valor_acordo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_acordos_demanda_externa_id_fkey"
            columns: ["demanda_externa_id"]
            isOneToOne: false
            referencedRelation: "empresa_demandas_externas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_contatos: {
        Row: {
          cargo: string | null
          created_at: string
          email: string | null
          empresa_id: string
          id: string
          nome: string
          organizacao_id: string
          pode_abrir_demanda: boolean
          principal: boolean
          telefone: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa_id: string
          id?: string
          nome: string
          organizacao_id: string
          pode_abrir_demanda?: boolean
          principal?: boolean
          telefone?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          organizacao_id?: string
          pode_abrir_demanda?: boolean
          principal?: boolean
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_contatos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_demandas_externas: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          organizacao_id: string
          parte_contraria: string | null
          prazo: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          organizacao_id: string
          parte_contraria?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          organizacao_id?: string
          parte_contraria?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_demandas_externas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_path: string
          created_at: string
          deleted_at: string | null
          descricao: string | null
          empresa_id: string
          enviado_por: string | null
          id: string
          mime_type: string | null
          organizacao_id: string
          tamanho_bytes: number | null
          titulo: string
          updated_at: string
          visivel_cliente: boolean
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_path: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id: string
          enviado_por?: string | null
          id?: string
          mime_type?: string | null
          organizacao_id: string
          tamanho_bytes?: number | null
          titulo: string
          updated_at?: string
          visivel_cliente?: boolean
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_path?: string
          created_at?: string
          deleted_at?: string | null
          descricao?: string | null
          empresa_id?: string
          enviado_por?: string | null
          id?: string
          mime_type?: string | null
          organizacao_id?: string
          tamanho_bytes?: number | null
          titulo?: string
          updated_at?: string
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "empresa_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_portal_usuarios: {
        Row: {
          ativo: boolean
          contato_id: string | null
          convidado_por: string | null
          created_at: string
          empresa_id: string
          id: string
          organizacao_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          contato_id?: string | null
          convidado_por?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          organizacao_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          contato_id?: string | null
          convidado_por?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          organizacao_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_portal_usuarios_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "empresa_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_portal_usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_portal_usuarios_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas_consultoria: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          nome_fantasia: string | null
          nps: number | null
          observacoes: string | null
          organizacao_id: string
          porte: string | null
          razao_social: string
          responsavel_id: string | null
          responsavel_pos_venda: string | null
          risco: string | null
          setor: string | null
          status: string
          ultimo_contato: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          nome_fantasia?: string | null
          nps?: number | null
          observacoes?: string | null
          organizacao_id: string
          porte?: string | null
          razao_social: string
          responsavel_id?: string | null
          responsavel_pos_venda?: string | null
          risco?: string | null
          setor?: string | null
          status?: string
          ultimo_contato?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          nome_fantasia?: string | null
          nps?: number | null
          observacoes?: string | null
          organizacao_id?: string
          porte?: string | null
          razao_social?: string
          responsavel_id?: string | null
          responsavel_pos_venda?: string | null
          risco?: string | null
          setor?: string | null
          status?: string
          ultimo_contato?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      execucao_citacoes: {
        Row: {
          advbox_lancado_em: string | null
          advbox_lancado_por: string | null
          citado: boolean
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_juntada: string | null
          execucao_id: string
          id: string
          organizacao_id: string | null
          papel: string
          pessoa_nome: string
          updated_at: string
        }
        Insert: {
          advbox_lancado_em?: string | null
          advbox_lancado_por?: string | null
          citado?: boolean
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_juntada?: string | null
          execucao_id: string
          id?: string
          organizacao_id?: string | null
          papel?: string
          pessoa_nome: string
          updated_at?: string
        }
        Update: {
          advbox_lancado_em?: string | null
          advbox_lancado_por?: string | null
          citado?: boolean
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_juntada?: string | null
          execucao_id?: string
          id?: string
          organizacao_id?: string | null
          papel?: string
          pessoa_nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "execucao_citacoes_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "cliente_execucoes"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          data: string
          id: string
          nome: string
          organizacao_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          nome: string
          organizacao_id: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          nome?: string
          organizacao_id?: string
          tipo?: string
        }
        Relationships: []
      }
      financeiro_cobrancas: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id: string
          cliente_nome: string | null
          created_at: string
          descricao: string | null
          id: string
          organizacao_id: string
          pago_em: string | null
          raw: Json
          sincronizado_em: string
          status: string | null
          tipo: string | null
          valor: number
          vencimento: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id: string
          cliente_nome?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          organizacao_id: string
          pago_em?: string | null
          raw?: Json
          sincronizado_em?: string
          status?: string | null
          tipo?: string | null
          valor?: number
          vencimento?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string
          cliente_nome?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          organizacao_id?: string
          pago_em?: string | null
          raw?: Json
          sincronizado_em?: string
          status?: string | null
          tipo?: string | null
          valor?: number
          vencimento?: string | null
        }
        Relationships: []
      }
      financeiro_lancamentos: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          data: string
          deleted_at: string | null
          descricao: string
          id: string
          organizacao_id: string
          origem: string
          setor: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          deleted_at?: string | null
          descricao: string
          id?: string
          organizacao_id: string
          origem?: string
          setor?: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          deleted_at?: string | null
          descricao?: string
          id?: string
          organizacao_id?: string
          origem?: string
          setor?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      honorarios_calculos: {
        Row: {
          cliente_documento: string | null
          cliente_nome: string
          complexidade_multiplicador: number
          created_at: string
          faixa_aplicada: number
          honorario_exito: number
          honorario_inicial: number
          honorario_total: number
          id: string
          numero_proposta: string | null
          operador_id: string
          organizacao_id: string | null
          status_verificacao: string
          valor_divida: number
        }
        Insert: {
          cliente_documento?: string | null
          cliente_nome: string
          complexidade_multiplicador?: number
          created_at?: string
          faixa_aplicada: number
          honorario_exito: number
          honorario_inicial: number
          honorario_total: number
          id?: string
          numero_proposta?: string | null
          operador_id: string
          organizacao_id?: string | null
          status_verificacao?: string
          valor_divida: number
        }
        Update: {
          cliente_documento?: string | null
          cliente_nome?: string
          complexidade_multiplicador?: number
          created_at?: string
          faixa_aplicada?: number
          honorario_exito?: number
          honorario_inicial?: number
          honorario_total?: number
          id?: string
          numero_proposta?: string | null
          operador_id?: string
          organizacao_id?: string | null
          status_verificacao?: string
          valor_divida?: number
        }
        Relationships: []
      }
      ia_consumo: {
        Row: {
          created_at: string
          duracao_ms: number | null
          erro_codigo: number | null
          funcao: string
          id: string
          input_tokens: number
          meta: Json | null
          modelo: string
          organizacao_id: string | null
          output_tokens: number
          provedor: string
          status: string
          total_tokens: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duracao_ms?: number | null
          erro_codigo?: number | null
          funcao: string
          id?: string
          input_tokens?: number
          meta?: Json | null
          modelo: string
          organizacao_id?: string | null
          output_tokens?: number
          provedor?: string
          status?: string
          total_tokens?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duracao_ms?: number | null
          erro_codigo?: number | null
          funcao?: string
          id?: string
          input_tokens?: number
          meta?: Json | null
          modelo?: string
          organizacao_id?: string | null
          output_tokens?: number
          provedor?: string
          status?: string
          total_tokens?: number
          user_id?: string | null
        }
        Relationships: []
      }
      kanban_card_anexos: {
        Row: {
          autor_id: string
          created_at: string
          id: string
          nome_arquivo: string
          organizacao_id: string
          processo_id: string
          storage_path: string
          tamanho_bytes: number
          tipo: string | null
        }
        Insert: {
          autor_id: string
          created_at?: string
          id?: string
          nome_arquivo: string
          organizacao_id: string
          processo_id: string
          storage_path: string
          tamanho_bytes?: number
          tipo?: string | null
        }
        Update: {
          autor_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string
          organizacao_id?: string
          processo_id?: string
          storage_path?: string
          tamanho_bytes?: number
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_anexos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_atividades: {
        Row: {
          autor_id: string | null
          created_at: string
          dados: Json
          id: string
          organizacao_id: string
          processo_id: string
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          created_at?: string
          dados?: Json
          id?: string
          organizacao_id: string
          processo_id: string
          tipo: string
        }
        Update: {
          autor_id?: string | null
          created_at?: string
          dados?: Json
          id?: string
          organizacao_id?: string
          processo_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_atividades_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_comentarios: {
        Row: {
          autor_id: string
          conteudo: string
          created_at: string
          id: string
          mencoes: string[]
          organizacao_id: string
          processo_id: string
          updated_at: string
        }
        Insert: {
          autor_id: string
          conteudo: string
          created_at?: string
          id?: string
          mencoes?: string[]
          organizacao_id: string
          processo_id: string
          updated_at?: string
        }
        Update: {
          autor_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          mencoes?: string[]
          organizacao_id?: string
          processo_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_comentarios_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_etiquetas: {
        Row: {
          created_at: string
          etiqueta_id: string
          id: string
          organizacao_id: string
          processo_id: string
        }
        Insert: {
          created_at?: string
          etiqueta_id: string
          id?: string
          organizacao_id: string
          processo_id: string
        }
        Update: {
          created_at?: string
          etiqueta_id?: string
          id?: string
          organizacao_id?: string
          processo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_etiquetas_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "kanban_etiquetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_card_etiquetas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_membros: {
        Row: {
          created_at: string
          id: string
          organizacao_id: string
          processo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organizacao_id: string
          processo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organizacao_id?: string
          processo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_membros_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_card_meta: {
        Row: {
          created_at: string
          descricao: string | null
          due_date: string | null
          due_origem: string
          organizacao_id: string
          processo_id: string
          sincroniza_prazo_15d: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          due_date?: string | null
          due_origem?: string
          organizacao_id: string
          processo_id: string
          sincroniza_prazo_15d?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          due_date?: string | null
          due_origem?: string
          organizacao_id?: string
          processo_id?: string
          sincroniza_prazo_15d?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_meta_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: true
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_checklist_itens: {
        Row: {
          checklist_id: string
          concluido: boolean
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          id: string
          ordem: number
          organizacao_id: string
          texto: string
          updated_at: string
        }
        Insert: {
          checklist_id: string
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          id?: string
          ordem?: number
          organizacao_id: string
          texto: string
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          concluido?: boolean
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          id?: string
          ordem?: number
          organizacao_id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_checklist_itens_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "kanban_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_checklist_templates: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          itens: Json
          nome: string
          organizacao_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          itens?: Json
          nome: string
          organizacao_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          itens?: Json
          nome?: string
          organizacao_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      kanban_checklists: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ordem: number
          organizacao_id: string
          processo_id: string
          template_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ordem?: number
          organizacao_id: string
          processo_id: string
          template_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ordem?: number
          organizacao_id?: string
          processo_id?: string
          template_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_checklists_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_checklists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "kanban_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_colunas: {
        Row: {
          arquivada: boolean
          cor: string
          created_at: string
          created_by: string | null
          id: string
          legacy_fase: string | null
          ordem: number
          organizacao_id: string
          slug: string
          titulo: string
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_fase?: string | null
          ordem?: number
          organizacao_id: string
          slug: string
          titulo: string
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          cor?: string
          created_at?: string
          created_by?: string | null
          id?: string
          legacy_fase?: string | null
          ordem?: number
          organizacao_id?: string
          slug?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      kanban_etiquetas: {
        Row: {
          categoria: string
          cor: string
          created_at: string
          id: string
          nome: string
          organizacao_id: string
          updated_at: string
        }
        Insert: {
          categoria?: string
          cor?: string
          created_at?: string
          id?: string
          nome: string
          organizacao_id: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          organizacao_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      laudo_conversas: {
        Row: {
          content: string
          created_at: string
          id: string
          laudo_id: string
          metadata: Json | null
          organizacao_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          laudo_id: string
          metadata?: Json | null
          organizacao_id?: string | null
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          laudo_id?: string
          metadata?: Json | null
          organizacao_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laudo_conversas_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "laudos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laudo_conversas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      laudo_etapa_historico: {
        Row: {
          created_at: string
          dias_na_etapa: number | null
          id: string
          laudo_id: string
          organizacao_id: string | null
          status_anterior: string | null
          status_novo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          dias_na_etapa?: number | null
          id?: string
          laudo_id: string
          organizacao_id?: string | null
          status_anterior?: string | null
          status_novo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          dias_na_etapa?: number | null
          id?: string
          laudo_id?: string
          organizacao_id?: string | null
          status_anterior?: string | null
          status_novo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laudo_etapa_historico_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "laudos"
            referencedColumns: ["id"]
          },
        ]
      }
      laudo_memoria: {
        Row: {
          chave: string
          created_at: string
          dados: Json
          id: string
          tipo: string
          updated_at: string
          user_id: string
          uso_count: number
        }
        Insert: {
          chave: string
          created_at?: string
          dados?: Json
          id?: string
          tipo: string
          updated_at?: string
          user_id: string
          uso_count?: number
        }
        Update: {
          chave?: string
          created_at?: string
          dados?: Json
          id?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          uso_count?: number
        }
        Relationships: []
      }
      laudos: {
        Row: {
          created_at: string
          dados_etapa1: Json | null
          dados_etapa2: Json | null
          dados_etapa3: Json | null
          dados_etapa4: Json | null
          dados_etapa5: Json | null
          dados_etapa6: Json | null
          deleted_at: string | null
          etapa_desde: string
          finalizado_em: string | null
          hipoteses_selecionadas: string[] | null
          id: string
          numero_laudo: string
          observacao: string | null
          organizacao_id: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["laudo_status"]
          texto_analise_narrativa: string | null
          texto_conclusao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dados_etapa1?: Json | null
          dados_etapa2?: Json | null
          dados_etapa3?: Json | null
          dados_etapa4?: Json | null
          dados_etapa5?: Json | null
          dados_etapa6?: Json | null
          deleted_at?: string | null
          etapa_desde?: string
          finalizado_em?: string | null
          hipoteses_selecionadas?: string[] | null
          id?: string
          numero_laudo: string
          observacao?: string | null
          organizacao_id?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["laudo_status"]
          texto_analise_narrativa?: string | null
          texto_conclusao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dados_etapa1?: Json | null
          dados_etapa2?: Json | null
          dados_etapa3?: Json | null
          dados_etapa4?: Json | null
          dados_etapa5?: Json | null
          dados_etapa6?: Json | null
          deleted_at?: string | null
          etapa_desde?: string
          finalizado_em?: string | null
          hipoteses_selecionadas?: string[] | null
          id?: string
          numero_laudo?: string
          observacao?: string | null
          organizacao_id?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["laudo_status"]
          texto_analise_narrativa?: string | null
          texto_conclusao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laudos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      membro_setores: {
        Row: {
          created_at: string
          id: string
          lider: boolean
          organizacao_id: string
          setor_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lider?: boolean
          organizacao_id: string
          setor_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lider?: boolean
          organizacao_id?: string
          setor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membro_setores_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membro_setores_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      membros: {
        Row: {
          areas: string[]
          created_at: string
          id: string
          is_ceo: boolean
          organizacao_id: string
          papel: Database["public"]["Enums"]["app_role"]
          permission_group_id: string | null
          user_id: string
        }
        Insert: {
          areas?: string[]
          created_at?: string
          id?: string
          is_ceo?: boolean
          organizacao_id: string
          papel?: Database["public"]["Enums"]["app_role"]
          permission_group_id?: string | null
          user_id: string
        }
        Update: {
          areas?: string[]
          created_at?: string
          id?: string
          is_ceo?: boolean
          organizacao_id?: string
          papel?: Database["public"]["Enums"]["app_role"]
          permission_group_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membros_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membros_permission_group_id_fkey"
            columns: ["permission_group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          anexos: Json
          autor_id: string
          conteudo: string
          conversa_id: string
          created_at: string
          editada_em: string | null
          excluida_em: string | null
          id: string
          mencoes: string[]
          organizacao_id: string
        }
        Insert: {
          anexos?: Json
          autor_id: string
          conteudo: string
          conversa_id: string
          created_at?: string
          editada_em?: string | null
          excluida_em?: string | null
          id?: string
          mencoes?: string[]
          organizacao_id: string
        }
        Update: {
          anexos?: Json
          autor_id?: string
          conteudo?: string
          conversa_id?: string
          created_at?: string
          editada_em?: string | null
          excluida_em?: string | null
          id?: string
          mencoes?: string[]
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      mkt_contratos_fechados: {
        Row: {
          cliente_contato: string | null
          cliente_estado: string | null
          cliente_nome: string
          closer_id: string | null
          created_at: string
          created_by: string
          credenciado_nome: string | null
          data_pagamento: string | null
          data_venda: string
          forma_pagamento: string | null
          id: string
          mes_referencia: string | null
          nicho: string
          num_parcelas: number
          observacoes: string | null
          organizacao_id: string
          plataforma: string | null
          porcentagem_final: number
          produto: string | null
          sdr_id: string | null
          tempo_fechamento_dias: number | null
          tipo_pagamento: string | null
          updated_at: string
          valor_entrada: number
          valor_parcela: number
          valor_recebido: number
          valor_total: number
          via_credenciado: boolean
        }
        Insert: {
          cliente_contato?: string | null
          cliente_estado?: string | null
          cliente_nome: string
          closer_id?: string | null
          created_at?: string
          created_by: string
          credenciado_nome?: string | null
          data_pagamento?: string | null
          data_venda: string
          forma_pagamento?: string | null
          id?: string
          mes_referencia?: string | null
          nicho: string
          num_parcelas?: number
          observacoes?: string | null
          organizacao_id: string
          plataforma?: string | null
          porcentagem_final?: number
          produto?: string | null
          sdr_id?: string | null
          tempo_fechamento_dias?: number | null
          tipo_pagamento?: string | null
          updated_at?: string
          valor_entrada?: number
          valor_parcela?: number
          valor_recebido?: number
          valor_total?: number
          via_credenciado?: boolean
        }
        Update: {
          cliente_contato?: string | null
          cliente_estado?: string | null
          cliente_nome?: string
          closer_id?: string | null
          created_at?: string
          created_by?: string
          credenciado_nome?: string | null
          data_pagamento?: string | null
          data_venda?: string
          forma_pagamento?: string | null
          id?: string
          mes_referencia?: string | null
          nicho?: string
          num_parcelas?: number
          observacoes?: string | null
          organizacao_id?: string
          plataforma?: string | null
          porcentagem_final?: number
          produto?: string | null
          sdr_id?: string | null
          tempo_fechamento_dias?: number | null
          tipo_pagamento?: string | null
          updated_at?: string
          valor_entrada?: number
          valor_parcela?: number
          valor_recebido?: number
          valor_total?: number
          via_credenciado?: boolean
        }
        Relationships: []
      }
      mkt_lancamentos_diarios: {
        Row: {
          alcance: number | null
          alcance_organico: number
          clientes_resgatados_followup: number
          cliques: number | null
          cliques_organico: number
          closer_id: string | null
          contratos_fechados: number | null
          contratos_perdidos: number | null
          created_at: string
          data: string
          follow_ups: number
          follow_ups_ligacao: number
          follow_ups_mensagem: number
          id: string
          impressoes: number | null
          impressoes_organico: number
          investimento: number | null
          investimento_organico: number
          leads_desqualificados_sdr: number
          leads_organicos: number | null
          leads_pagos: number | null
          leads_qualificados_sdr: number | null
          ligacoes: number
          motivo_perda_principal: string | null
          negocios_recuperados: number
          nicho: string
          observacoes: string | null
          organizacao_id: string | null
          propostas_enviadas: number | null
          receita_fechada: number | null
          reunioes_agendadas: number | null
          reunioes_realizadas: number | null
          sdr_id: string | null
          sdr_ligacoes_atendidas: number
          sdr_ligacoes_realizadas: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alcance?: number | null
          alcance_organico?: number
          clientes_resgatados_followup?: number
          cliques?: number | null
          cliques_organico?: number
          closer_id?: string | null
          contratos_fechados?: number | null
          contratos_perdidos?: number | null
          created_at?: string
          data: string
          follow_ups?: number
          follow_ups_ligacao?: number
          follow_ups_mensagem?: number
          id?: string
          impressoes?: number | null
          impressoes_organico?: number
          investimento?: number | null
          investimento_organico?: number
          leads_desqualificados_sdr?: number
          leads_organicos?: number | null
          leads_pagos?: number | null
          leads_qualificados_sdr?: number | null
          ligacoes?: number
          motivo_perda_principal?: string | null
          negocios_recuperados?: number
          nicho: string
          observacoes?: string | null
          organizacao_id?: string | null
          propostas_enviadas?: number | null
          receita_fechada?: number | null
          reunioes_agendadas?: number | null
          reunioes_realizadas?: number | null
          sdr_id?: string | null
          sdr_ligacoes_atendidas?: number
          sdr_ligacoes_realizadas?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alcance?: number | null
          alcance_organico?: number
          clientes_resgatados_followup?: number
          cliques?: number | null
          cliques_organico?: number
          closer_id?: string | null
          contratos_fechados?: number | null
          contratos_perdidos?: number | null
          created_at?: string
          data?: string
          follow_ups?: number
          follow_ups_ligacao?: number
          follow_ups_mensagem?: number
          id?: string
          impressoes?: number | null
          impressoes_organico?: number
          investimento?: number | null
          investimento_organico?: number
          leads_desqualificados_sdr?: number
          leads_organicos?: number | null
          leads_pagos?: number | null
          leads_qualificados_sdr?: number | null
          ligacoes?: number
          motivo_perda_principal?: string | null
          negocios_recuperados?: number
          nicho?: string
          observacoes?: string | null
          organizacao_id?: string | null
          propostas_enviadas?: number | null
          receita_fechada?: number | null
          reunioes_agendadas?: number | null
          reunioes_realizadas?: number | null
          sdr_id?: string | null
          sdr_ligacoes_atendidas?: number
          sdr_ligacoes_realizadas?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mkt_leads_diarios: {
        Row: {
          closer_id: string | null
          contato: string | null
          created_at: string
          data: string
          id: string
          motivo_desqualificacao: string | null
          motivo_outro: string | null
          nicho: string
          nome: string | null
          observacoes: string | null
          organizacao_id: string
          origem: string
          origem_detalhe: string | null
          sdr_id: string | null
          status_qualificacao: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closer_id?: string | null
          contato?: string | null
          created_at?: string
          data: string
          id?: string
          motivo_desqualificacao?: string | null
          motivo_outro?: string | null
          nicho: string
          nome?: string | null
          observacoes?: string | null
          organizacao_id: string
          origem?: string
          origem_detalhe?: string | null
          sdr_id?: string | null
          status_qualificacao?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closer_id?: string | null
          contato?: string | null
          created_at?: string
          data?: string
          id?: string
          motivo_desqualificacao?: string | null
          motivo_outro?: string | null
          nicho?: string
          nome?: string | null
          observacoes?: string | null
          organizacao_id?: string
          origem?: string
          origem_detalhe?: string | null
          sdr_id?: string | null
          status_qualificacao?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mkt_leads_organicos_origem: {
        Row: {
          created_at: string
          data: string
          id: string
          indicado_por: string | null
          nicho: string
          observacoes: string | null
          organizacao_id: string | null
          origem_tipo: string
          quantidade: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          indicado_por?: string | null
          nicho: string
          observacoes?: string | null
          organizacao_id?: string | null
          origem_tipo: string
          quantidade?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          indicado_por?: string | null
          nicho?: string
          observacoes?: string | null
          organizacao_id?: string | null
          origem_tipo?: string
          quantidade?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mkt_meta_ads_config: {
        Row: {
          ad_account_id: string
          ad_account_nome: string | null
          ativo: boolean
          campaign_ids: string[]
          campaign_nomes: Json
          created_at: string
          id: string
          nicho: string
          organizacao_id: string
          ultima_sync_at: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          ad_account_nome?: string | null
          ativo?: boolean
          campaign_ids?: string[]
          campaign_nomes?: Json
          created_at?: string
          id?: string
          nicho: string
          organizacao_id: string
          ultima_sync_at?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          ad_account_nome?: string | null
          ativo?: boolean
          campaign_ids?: string[]
          campaign_nomes?: Json
          created_at?: string
          id?: string
          nicho?: string
          organizacao_id?: string
          ultima_sync_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mkt_meta_ads_sync_log: {
        Row: {
          ad_account_id: string
          alcance: number | null
          campaign_ids: string[] | null
          cliques: number | null
          created_at: string
          data_referencia: string
          erro_mensagem: string | null
          id: string
          impressoes: number | null
          investimento: number | null
          leads: number | null
          nicho: string
          organizacao_id: string
          status: string
          trigger_tipo: string
        }
        Insert: {
          ad_account_id: string
          alcance?: number | null
          campaign_ids?: string[] | null
          cliques?: number | null
          created_at?: string
          data_referencia: string
          erro_mensagem?: string | null
          id?: string
          impressoes?: number | null
          investimento?: number | null
          leads?: number | null
          nicho: string
          organizacao_id: string
          status: string
          trigger_tipo?: string
        }
        Update: {
          ad_account_id?: string
          alcance?: number | null
          campaign_ids?: string[] | null
          cliques?: number | null
          created_at?: string
          data_referencia?: string
          erro_mensagem?: string | null
          id?: string
          impressoes?: number | null
          investimento?: number | null
          leads?: number | null
          nicho?: string
          organizacao_id?: string
          status?: string
          trigger_tipo?: string
        }
        Relationships: []
      }
      mkt_metas_individuais: {
        Row: {
          ano: number
          comissao_bateu: number
          comissao_nao_bateu: number
          comissao_supermeta: number
          created_at: string
          id: string
          membro_user_id: string
          mes: number
          meta_contratos: number
          meta_credenciados: number
          meta_leads_qualificados: number
          meta_receita: number
          meta_reunioes_realizadas: number
          meta_supermeta_valor_total: number
          meta_valor_total_contratos: number
          organizacao_id: string
          pct_entrada: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ano: number
          comissao_bateu?: number
          comissao_nao_bateu?: number
          comissao_supermeta?: number
          created_at?: string
          id?: string
          membro_user_id: string
          mes: number
          meta_contratos?: number
          meta_credenciados?: number
          meta_leads_qualificados?: number
          meta_receita?: number
          meta_reunioes_realizadas?: number
          meta_supermeta_valor_total?: number
          meta_valor_total_contratos?: number
          organizacao_id: string
          pct_entrada?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number
          comissao_bateu?: number
          comissao_nao_bateu?: number
          comissao_supermeta?: number
          created_at?: string
          id?: string
          membro_user_id?: string
          mes?: number
          meta_contratos?: number
          meta_credenciados?: number
          meta_leads_qualificados?: number
          meta_receita?: number
          meta_reunioes_realizadas?: number
          meta_supermeta_valor_total?: number
          meta_valor_total_contratos?: number
          organizacao_id?: string
          pct_entrada?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mkt_metas_mensais: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          meta_contratos: number | null
          meta_investimento: number | null
          meta_leads_organicos: number | null
          meta_leads_pagos: number | null
          meta_receita: number | null
          nicho: string
          organizacao_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          meta_contratos?: number | null
          meta_investimento?: number | null
          meta_leads_organicos?: number | null
          meta_leads_pagos?: number | null
          meta_receita?: number | null
          nicho: string
          organizacao_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          meta_contratos?: number | null
          meta_investimento?: number | null
          meta_leads_organicos?: number | null
          meta_leads_pagos?: number | null
          meta_receita?: number | null
          nicho?: string
          organizacao_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mkt_tentativas_data_futura: {
        Row: {
          contexto: string
          created_at: string
          data_tentada: string
          id: string
          organizacao_id: string
          pagina: string | null
          user_id: string
        }
        Insert: {
          contexto: string
          created_at?: string
          data_tentada: string
          id?: string
          organizacao_id: string
          pagina?: string | null
          user_id: string
        }
        Update: {
          contexto?: string
          created_at?: string
          data_tentada?: string
          id?: string
          organizacao_id?: string
          pagina?: string | null
          user_id?: string
        }
        Relationships: []
      }
      movimentacoes: {
        Row: {
          created_at: string
          deleted_at: string | null
          descricao: string
          documento_url: string | null
          fase: Database["public"]["Enums"]["fase_processo"]
          id: string
          organizacao_id: string | null
          processo_id: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          descricao: string
          documento_url?: string | null
          fase: Database["public"]["Enums"]["fase_processo"]
          id?: string
          organizacao_id?: string | null
          processo_id: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          descricao?: string
          documento_url?: string | null
          fase?: Database["public"]["Enums"]["fase_processo"]
          id?: string
          organizacao_id?: string | null
          processo_id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_complementacoes: {
        Row: {
          arquivo: string | null
          canal: string | null
          created_at: string
          data: string
          id: string
          notificacao_id: string
          observacao: string | null
          operacoes: string[]
          organizacao_id: string
          referencia: string | null
          registrado_nome: string | null
          registrado_por: string | null
        }
        Insert: {
          arquivo?: string | null
          canal?: string | null
          created_at?: string
          data: string
          id?: string
          notificacao_id: string
          observacao?: string | null
          operacoes?: string[]
          organizacao_id: string
          referencia?: string | null
          registrado_nome?: string | null
          registrado_por?: string | null
        }
        Update: {
          arquivo?: string | null
          canal?: string | null
          created_at?: string
          data?: string
          id?: string
          notificacao_id?: string
          observacao?: string | null
          operacoes?: string[]
          organizacao_id?: string
          referencia?: string | null
          registrado_nome?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_complementacoes_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes_banco"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_config: {
        Row: {
          dias_contato_cliente: number
          dias_sem_resposta: number
          dias_silencio: number
          organizacao_id: string
          prazo_consumidor_gov: number
          prazo_outros_canais: number
          updated_at: string
        }
        Insert: {
          dias_contato_cliente?: number
          dias_sem_resposta?: number
          dias_silencio?: number
          organizacao_id: string
          prazo_consumidor_gov?: number
          prazo_outros_canais?: number
          updated_at?: string
        }
        Update: {
          dias_contato_cliente?: number
          dias_sem_resposta?: number
          dias_silencio?: number
          organizacao_id?: string
          prazo_consumidor_gov?: number
          prazo_outros_canais?: number
          updated_at?: string
        }
        Relationships: []
      }
      notificacao_contatos: {
        Row: {
          canal: string
          created_at: string
          data: string
          id: string
          notificacao_id: string
          organizacao_id: string
          registrado_nome: string | null
          registrado_por: string | null
          resumo: string
        }
        Insert: {
          canal: string
          created_at?: string
          data?: string
          id?: string
          notificacao_id: string
          organizacao_id: string
          registrado_nome?: string | null
          registrado_por?: string | null
          resumo: string
        }
        Update: {
          canal?: string
          created_at?: string
          data?: string
          id?: string
          notificacao_id?: string
          organizacao_id?: string
          registrado_nome?: string | null
          registrado_por?: string | null
          resumo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_contatos_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes_banco"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_decisoes: {
        Row: {
          created_at: string
          decidido_nome: string | null
          decidido_por: string | null
          decisao: string
          id: string
          motivo: string | null
          notificacao_id: string
          organizacao_id: string
          sugestao: string | null
        }
        Insert: {
          created_at?: string
          decidido_nome?: string | null
          decidido_por?: string | null
          decisao: string
          id?: string
          motivo?: string | null
          notificacao_id: string
          organizacao_id: string
          sugestao?: string | null
        }
        Update: {
          created_at?: string
          decidido_nome?: string | null
          decidido_por?: string | null
          decisao?: string
          id?: string
          motivo?: string | null
          notificacao_id?: string
          organizacao_id?: string
          sugestao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_decisoes_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes_banco"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_banco: {
        Row: {
          banco: string
          cliente_id: string | null
          cobranca_prazo: string | null
          contador_desde: string | null
          created_at: string
          created_by: string | null
          decisao: string | null
          decisao_em: string | null
          decisao_motivo: string | null
          decisao_por: string | null
          estado: string
          id: string
          observacao: string | null
          organizacao_id: string
          protocolo_canal: string | null
          protocolo_data: string | null
          protocolo_ref: string | null
          responsavel: string | null
          resposta_anexo: string | null
          resposta_data: string | null
          resposta_resultado: string | null
          silencio_banco: boolean
          titular_nome: string
          ultimo_contato_cliente: string | null
          updated_at: string
        }
        Insert: {
          banco: string
          cliente_id?: string | null
          cobranca_prazo?: string | null
          contador_desde?: string | null
          created_at?: string
          created_by?: string | null
          decisao?: string | null
          decisao_em?: string | null
          decisao_motivo?: string | null
          decisao_por?: string | null
          estado?: string
          id?: string
          observacao?: string | null
          organizacao_id: string
          protocolo_canal?: string | null
          protocolo_data?: string | null
          protocolo_ref?: string | null
          responsavel?: string | null
          resposta_anexo?: string | null
          resposta_data?: string | null
          resposta_resultado?: string | null
          silencio_banco?: boolean
          titular_nome: string
          ultimo_contato_cliente?: string | null
          updated_at?: string
        }
        Update: {
          banco?: string
          cliente_id?: string | null
          cobranca_prazo?: string | null
          contador_desde?: string | null
          created_at?: string
          created_by?: string | null
          decisao?: string | null
          decisao_em?: string | null
          decisao_motivo?: string | null
          decisao_por?: string | null
          estado?: string
          id?: string
          observacao?: string | null
          organizacao_id?: string
          protocolo_canal?: string | null
          protocolo_data?: string | null
          protocolo_ref?: string | null
          responsavel?: string | null
          resposta_anexo?: string | null
          resposta_data?: string | null
          resposta_resultado?: string | null
          silencio_banco?: boolean
          titular_nome?: string
          ultimo_contato_cliente?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_banco_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_sistema: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          processo_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          processo_id?: string | null
          tipo?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          processo_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_sistema_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      ofertas_catalogo: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          id: string
          marca: string
          modo: string
          modo_contratacao: string
          organizacao_id: string
          preco: number | null
          publico: boolean
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          marca: string
          modo: string
          modo_contratacao?: string
          organizacao_id: string
          preco?: number | null
          publico?: boolean
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          id?: string
          marca?: string
          modo?: string
          modo_contratacao?: string
          organizacao_id?: string
          preco?: number | null
          publico?: boolean
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      olivia_conhecimento: {
        Row: {
          categoria: string
          conteudo: string
          created_at: string
          embedding: string | null
          fonte: string | null
          id: string
          metadata: Json | null
          organizacao_id: string
          tags: string[] | null
          titulo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string
          conteudo: string
          created_at?: string
          embedding?: string | null
          fonte?: string | null
          id?: string
          metadata?: Json | null
          organizacao_id: string
          tags?: string[] | null
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          categoria?: string
          conteudo?: string
          created_at?: string
          embedding?: string | null
          fonte?: string | null
          id?: string
          metadata?: Json | null
          organizacao_id?: string
          tags?: string[] | null
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      olivia_conversas: {
        Row: {
          created_at: string
          id: string
          organizacao_id: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organizacao_id?: string | null
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organizacao_id?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      olivia_mensagens: {
        Row: {
          acoes: Json
          content: string
          conversa_id: string
          created_at: string
          id: string
          role: string
          rota_origem: string | null
          user_id: string
        }
        Insert: {
          acoes?: Json
          content?: string
          conversa_id: string
          created_at?: string
          id?: string
          role: string
          rota_origem?: string | null
          user_id: string
        }
        Update: {
          acoes?: Json
          content?: string
          conversa_id?: string
          created_at?: string
          id?: string
          role?: string
          rota_origem?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "olivia_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "olivia_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      operacao_avalistas: {
        Row: {
          conjuge_anuiu: string
          cpf: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          observacao: string | null
          operacao_id: string
          organizacao_id: string | null
          pessoa_id: string | null
        }
        Insert: {
          conjuge_anuiu?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          observacao?: string | null
          operacao_id: string
          organizacao_id?: string | null
          pessoa_id?: string | null
        }
        Update: {
          conjuge_anuiu?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          operacao_id?: string
          organizacao_id?: string | null
          pessoa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operacao_avalistas_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes_credito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacao_avalistas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      operacao_estrategia_hist: {
        Row: {
          alterado_por: string | null
          alterado_por_nome: string | null
          created_at: string
          de: string | null
          id: string
          motivo: string
          operacao_id: string
          organizacao_id: string | null
          para: string
        }
        Insert: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          created_at?: string
          de?: string | null
          id?: string
          motivo: string
          operacao_id: string
          organizacao_id?: string | null
          para: string
        }
        Update: {
          alterado_por?: string | null
          alterado_por_nome?: string | null
          created_at?: string
          de?: string | null
          id?: string
          motivo?: string
          operacao_id?: string
          organizacao_id?: string | null
          para?: string
        }
        Relationships: [
          {
            foreignKeyName: "operacao_estrategia_hist_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      operacao_garantias: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          grau: string | null
          id: string
          identificacao: string | null
          observacao: string | null
          onde_registrada: string | null
          operacao_id: string
          organizacao_id: string | null
          situacao: string
          tipo: string
          updated_at: string
          valor_avaliacao: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          grau?: string | null
          id?: string
          identificacao?: string | null
          observacao?: string | null
          onde_registrada?: string | null
          operacao_id: string
          organizacao_id?: string | null
          situacao?: string
          tipo: string
          updated_at?: string
          valor_avaliacao?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          grau?: string | null
          id?: string
          identificacao?: string | null
          observacao?: string | null
          onde_registrada?: string | null
          operacao_id?: string
          organizacao_id?: string | null
          situacao?: string
          tipo?: string
          updated_at?: string
          valor_avaliacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "operacao_garantias_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      operacoes_credito: {
        Row: {
          advbox_lawsuits_id: string | null
          advbox_titular_customers_id: string | null
          advbox_vinculo_obs: string | null
          advbox_vinculo_origem: string | null
          advbox_vinculo_status: string | null
          alteracao_motivo: string | null
          banco: string | null
          cadastrado_em: string
          cadastrado_por: string | null
          cedula_path: string | null
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_conferida: boolean
          data_conferida_em: string | null
          data_conferida_por: string | null
          decisao_em: string | null
          decisao_obs: string | null
          decisao_por: string | null
          decisao_vencida: string | null
          deleted_at: string | null
          dispensa_motivo: string | null
          dispensar_alerta: boolean
          duplicata_de: string | null
          duplicata_motivo: string | null
          duplicata_status: string | null
          entrada_urgente: boolean
          estrategia: string | null
          estrategia_em: string | null
          estrategia_por: string | null
          execucao_ativa: boolean
          execucao_tipo: string | null
          grupo: string | null
          historico_em: string | null
          historico_manual: boolean
          historico_motivo: string | null
          id: string
          juizo_conferencia: string | null
          juizo_conferido_em: string | null
          juizo_manual: boolean
          juizo_obs: string | null
          juizo_operacao_na_inicial: string | null
          juizo_processo_numero: string | null
          laudo_retificacao_avaliada_em: string | null
          laudo_status: string
          modalidade: string | null
          nao_bancaria: boolean
          natureza_credito: string | null
          notificado_em: string | null
          numero: string
          numero_anterior: string | null
          numero_invalido: boolean
          organizacao_id: string
          origem_arquivo: string | null
          pendencia_completar: boolean
          pendencia_prazo: string | null
          pendencia_resolvida_em: string | null
          pendencia_resolvida_por: string | null
          precisa_laudo: boolean
          pronta_em: string | null
          pronta_por: string | null
          pronta_protocolar: boolean
          protocolo_atraso: boolean
          protocolo_faltava: string[]
          protocolo_por_cpf: boolean | null
          protocolo_ref: string | null
          protocolo_urgencia: boolean
          responsavel: string | null
          restaurada_conferir: boolean
          saldo_devedor: number | null
          status_conferencia: string
          titular_a_definir: boolean
          titular_nome: string | null
          trecho: string | null
          updated_at: string
          urgencia_em: string | null
          vence_em: string | null
          vinculo_adiado_em: string | null
        }
        Insert: {
          advbox_lawsuits_id?: string | null
          advbox_titular_customers_id?: string | null
          advbox_vinculo_obs?: string | null
          advbox_vinculo_origem?: string | null
          advbox_vinculo_status?: string | null
          alteracao_motivo?: string | null
          banco?: string | null
          cadastrado_em?: string
          cadastrado_por?: string | null
          cedula_path?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_conferida?: boolean
          data_conferida_em?: string | null
          data_conferida_por?: string | null
          decisao_em?: string | null
          decisao_obs?: string | null
          decisao_por?: string | null
          decisao_vencida?: string | null
          deleted_at?: string | null
          dispensa_motivo?: string | null
          dispensar_alerta?: boolean
          duplicata_de?: string | null
          duplicata_motivo?: string | null
          duplicata_status?: string | null
          entrada_urgente?: boolean
          estrategia?: string | null
          estrategia_em?: string | null
          estrategia_por?: string | null
          execucao_ativa?: boolean
          execucao_tipo?: string | null
          grupo?: string | null
          historico_em?: string | null
          historico_manual?: boolean
          historico_motivo?: string | null
          id?: string
          juizo_conferencia?: string | null
          juizo_conferido_em?: string | null
          juizo_manual?: boolean
          juizo_obs?: string | null
          juizo_operacao_na_inicial?: string | null
          juizo_processo_numero?: string | null
          laudo_retificacao_avaliada_em?: string | null
          laudo_status?: string
          modalidade?: string | null
          nao_bancaria?: boolean
          natureza_credito?: string | null
          notificado_em?: string | null
          numero: string
          numero_anterior?: string | null
          numero_invalido?: boolean
          organizacao_id: string
          origem_arquivo?: string | null
          pendencia_completar?: boolean
          pendencia_prazo?: string | null
          pendencia_resolvida_em?: string | null
          pendencia_resolvida_por?: string | null
          precisa_laudo?: boolean
          pronta_em?: string | null
          pronta_por?: string | null
          pronta_protocolar?: boolean
          protocolo_atraso?: boolean
          protocolo_faltava?: string[]
          protocolo_por_cpf?: boolean | null
          protocolo_ref?: string | null
          protocolo_urgencia?: boolean
          responsavel?: string | null
          restaurada_conferir?: boolean
          saldo_devedor?: number | null
          status_conferencia?: string
          titular_a_definir?: boolean
          titular_nome?: string | null
          trecho?: string | null
          updated_at?: string
          urgencia_em?: string | null
          vence_em?: string | null
          vinculo_adiado_em?: string | null
        }
        Update: {
          advbox_lawsuits_id?: string | null
          advbox_titular_customers_id?: string | null
          advbox_vinculo_obs?: string | null
          advbox_vinculo_origem?: string | null
          advbox_vinculo_status?: string | null
          alteracao_motivo?: string | null
          banco?: string | null
          cadastrado_em?: string
          cadastrado_por?: string | null
          cedula_path?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_conferida?: boolean
          data_conferida_em?: string | null
          data_conferida_por?: string | null
          decisao_em?: string | null
          decisao_obs?: string | null
          decisao_por?: string | null
          decisao_vencida?: string | null
          deleted_at?: string | null
          dispensa_motivo?: string | null
          dispensar_alerta?: boolean
          duplicata_de?: string | null
          duplicata_motivo?: string | null
          duplicata_status?: string | null
          entrada_urgente?: boolean
          estrategia?: string | null
          estrategia_em?: string | null
          estrategia_por?: string | null
          execucao_ativa?: boolean
          execucao_tipo?: string | null
          grupo?: string | null
          historico_em?: string | null
          historico_manual?: boolean
          historico_motivo?: string | null
          id?: string
          juizo_conferencia?: string | null
          juizo_conferido_em?: string | null
          juizo_manual?: boolean
          juizo_obs?: string | null
          juizo_operacao_na_inicial?: string | null
          juizo_processo_numero?: string | null
          laudo_retificacao_avaliada_em?: string | null
          laudo_status?: string
          modalidade?: string | null
          nao_bancaria?: boolean
          natureza_credito?: string | null
          notificado_em?: string | null
          numero?: string
          numero_anterior?: string | null
          numero_invalido?: boolean
          organizacao_id?: string
          origem_arquivo?: string | null
          pendencia_completar?: boolean
          pendencia_prazo?: string | null
          pendencia_resolvida_em?: string | null
          pendencia_resolvida_por?: string | null
          precisa_laudo?: boolean
          pronta_em?: string | null
          pronta_por?: string | null
          pronta_protocolar?: boolean
          protocolo_atraso?: boolean
          protocolo_faltava?: string[]
          protocolo_por_cpf?: boolean | null
          protocolo_ref?: string | null
          protocolo_urgencia?: boolean
          responsavel?: string | null
          restaurada_conferir?: boolean
          saldo_devedor?: number | null
          status_conferencia?: string
          titular_a_definir?: boolean
          titular_nome?: string | null
          trecho?: string | null
          updated_at?: string
          urgencia_em?: string | null
          vence_em?: string | null
          vinculo_adiado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operacoes_credito_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacoes_credito_duplicata_de_fkey"
            columns: ["duplicata_de"]
            isOneToOne: false
            referencedRelation: "operacoes_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          created_at: string
          organizacao_id: string
          responsavel_pos_venda_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          organizacao_id: string
          responsavel_pos_venda_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          organizacao_id?: string
          responsavel_pos_venda_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      organizacoes: {
        Row: {
          created_at: string
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          oab_numero: string | null
          oab_uf: string | null
          plano: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          oab_numero?: string | null
          oab_uf?: string | null
          plano?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          oab_numero?: string | null
          oab_uf?: string | null
          plano?: string
          updated_at?: string
        }
        Relationships: []
      }
      pedidos_servico: {
        Row: {
          cliente_id: string | null
          created_at: string
          deleted_at: string | null
          empresa_id: string | null
          id: string
          marca: string
          observacao: string | null
          oferta_id: string | null
          organizacao_id: string
          origem: string
          responsavel_id: string | null
          solicitado_por: string | null
          status: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          deleted_at?: string | null
          empresa_id?: string | null
          id?: string
          marca: string
          observacao?: string | null
          oferta_id?: string | null
          organizacao_id: string
          origem?: string
          responsavel_id?: string | null
          solicitado_por?: string | null
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          deleted_at?: string | null
          empresa_id?: string | null
          id?: string
          marca?: string
          observacao?: string | null
          oferta_id?: string | null
          organizacao_id?: string
          origem?: string
          responsavel_id?: string | null
          solicitado_por?: string | null
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_servico_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "ofertas_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_servico_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: false
            referencedRelation: "portal_ofertas_view"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_groups: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          modulos: string[]
          nome: string
          organizacao_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          modulos?: string[]
          nome: string
          organizacao_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          modulos?: string[]
          nome?: string
          organizacao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_groups_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      peticoes: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          laudo_id: string | null
          metadata: Json
          organizacao_id: string | null
          processo_id: string | null
          secoes: Json
          status: string
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          laudo_id?: string | null
          metadata?: Json
          organizacao_id?: string | null
          processo_id?: string | null
          secoes?: Json
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          laudo_id?: string | null
          metadata?: Json
          organizacao_id?: string | null
          processo_id?: string | null
          secoes?: Json
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peticoes_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "laudos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peticoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peticoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_chamado_mensagens: {
        Row: {
          anexos: Json
          autor_id: string
          autor_tipo: string
          chamado_id: string
          conteudo: string
          created_at: string
          id: string
          organizacao_id: string
        }
        Insert: {
          anexos?: Json
          autor_id: string
          autor_tipo: string
          chamado_id: string
          conteudo: string
          created_at?: string
          id?: string
          organizacao_id: string
        }
        Update: {
          anexos?: Json
          autor_id?: string
          autor_tipo?: string
          chamado_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          organizacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_chamado_mensagens_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "portal_chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_chamados: {
        Row: {
          aberto_por: string
          aberto_por_tipo: string
          banco: string | null
          cliente_id: string
          contrato_id: string | null
          created_at: string
          descricao: string | null
          id: string
          organizacao_id: string
          prioridade: string
          processo_id: string | null
          resolvido_em: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          titulo: string
          ultima_mensagem_em: string
          updated_at: string
        }
        Insert: {
          aberto_por: string
          aberto_por_tipo?: string
          banco?: string | null
          cliente_id: string
          contrato_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          organizacao_id: string
          prioridade?: string
          processo_id?: string | null
          resolvido_em?: string | null
          responsavel_id?: string | null
          status?: string
          tipo: string
          titulo: string
          ultima_mensagem_em?: string
          updated_at?: string
        }
        Update: {
          aberto_por?: string
          aberto_por_tipo?: string
          banco?: string | null
          cliente_id?: string
          contrato_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          organizacao_id?: string
          prioridade?: string
          processo_id?: string | null
          resolvido_em?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          ultima_mensagem_em?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_chamados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_chamados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_vencimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_chamados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "portal_cliente_contratos_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_chamados_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_chamados_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_venda_checklist_itens: {
        Row: {
          anexo_nome: string | null
          anexo_url: string | null
          arquivado_em: string | null
          categoria: string
          categoria_label: string
          chave: string | null
          conferido_em: string | null
          conferido_por: string | null
          created_at: string
          data_recebimento: string | null
          documento: string
          etapa: number
          finalidade: string | null
          id: string
          motivo_dispensa: string | null
          nivel: string
          nome_simples: string | null
          obrigatorio: boolean
          observacoes: string | null
          onboarding_id: string
          onde_obter: string | null
          operacao_id: string | null
          operacao_label: string | null
          ordem: number
          organizacao_id: string | null
          origem: string
          prioridade: string
          status: string
          titular_cliente_id: string | null
          titular_nome: string | null
          updated_at: string
          validade_tipica: string | null
        }
        Insert: {
          anexo_nome?: string | null
          anexo_url?: string | null
          arquivado_em?: string | null
          categoria: string
          categoria_label: string
          chave?: string | null
          conferido_em?: string | null
          conferido_por?: string | null
          created_at?: string
          data_recebimento?: string | null
          documento: string
          etapa?: number
          finalidade?: string | null
          id?: string
          motivo_dispensa?: string | null
          nivel?: string
          nome_simples?: string | null
          obrigatorio?: boolean
          observacoes?: string | null
          onboarding_id: string
          onde_obter?: string | null
          operacao_id?: string | null
          operacao_label?: string | null
          ordem?: number
          organizacao_id?: string | null
          origem?: string
          prioridade?: string
          status?: string
          titular_cliente_id?: string | null
          titular_nome?: string | null
          updated_at?: string
          validade_tipica?: string | null
        }
        Update: {
          anexo_nome?: string | null
          anexo_url?: string | null
          arquivado_em?: string | null
          categoria?: string
          categoria_label?: string
          chave?: string | null
          conferido_em?: string | null
          conferido_por?: string | null
          created_at?: string
          data_recebimento?: string | null
          documento?: string
          etapa?: number
          finalidade?: string | null
          id?: string
          motivo_dispensa?: string | null
          nivel?: string
          nome_simples?: string | null
          obrigatorio?: boolean
          observacoes?: string | null
          onboarding_id?: string
          onde_obter?: string | null
          operacao_id?: string | null
          operacao_label?: string | null
          ordem?: number
          organizacao_id?: string | null
          origem?: string
          prioridade?: string
          status?: string
          titular_cliente_id?: string | null
          titular_nome?: string | null
          updated_at?: string
          validade_tipica?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_venda_checklist_itens_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "pos_venda_onboardings"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_venda_govbr_acessos: {
        Row: {
          cliente_id: string | null
          conduzido_por: string | null
          conduzido_por_nome: string | null
          created_at: string
          data: string
          finalidade: string
          forma: string
          id: string
          nivel_conta: string | null
          onboarding_id: string
          organizacao_id: string
          titular_nome: string | null
        }
        Insert: {
          cliente_id?: string | null
          conduzido_por?: string | null
          conduzido_por_nome?: string | null
          created_at?: string
          data?: string
          finalidade?: string
          forma: string
          id?: string
          nivel_conta?: string | null
          onboarding_id: string
          organizacao_id: string
          titular_nome?: string | null
        }
        Update: {
          cliente_id?: string | null
          conduzido_por?: string | null
          conduzido_por_nome?: string | null
          created_at?: string
          data?: string
          finalidade?: string
          forma?: string
          id?: string
          nivel_conta?: string | null
          onboarding_id?: string
          organizacao_id?: string
          titular_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_venda_govbr_acessos_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "pos_venda_onboardings"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_venda_onboardings: {
        Row: {
          area_hectares: number | null
          bancos: string[] | null
          cliente_contato: string | null
          cliente_id: string | null
          cliente_nome: string
          concluido_em: string | null
          contrato_fechado_id: string | null
          cpf_cnpj: string | null
          created_at: string
          deleted_at: string | null
          deleted_motivo: string | null
          entrada_urgente: boolean
          etapa_atual: number
          grupo: string | null
          id: string
          iniciado_em: string
          lead_id: string | null
          modulos_opcionais: Json
          observacoes: string | null
          organizacao_id: string | null
          responsavel_id: string
          respostas: Json
          status: string
          updated_at: string
        }
        Insert: {
          area_hectares?: number | null
          bancos?: string[] | null
          cliente_contato?: string | null
          cliente_id?: string | null
          cliente_nome: string
          concluido_em?: string | null
          contrato_fechado_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_motivo?: string | null
          entrada_urgente?: boolean
          etapa_atual?: number
          grupo?: string | null
          id?: string
          iniciado_em?: string
          lead_id?: string | null
          modulos_opcionais?: Json
          observacoes?: string | null
          organizacao_id?: string | null
          responsavel_id: string
          respostas?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          area_hectares?: number | null
          bancos?: string[] | null
          cliente_contato?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          concluido_em?: string | null
          contrato_fechado_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_motivo?: string | null
          entrada_urgente?: boolean
          etapa_atual?: number
          grupo?: string | null
          id?: string
          iniciado_em?: string
          lead_id?: string | null
          modulos_opcionais?: Json
          observacoes?: string | null
          organizacao_id?: string | null
          responsavel_id?: string
          respostas?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      processo_andamentos: {
        Row: {
          advbox_lawsuit_id: string
          advbox_movement_id: string
          created_at: string
          data: string
          descricao: string
          id: string
          organizacao_id: string
          origem: string
          processo_id: string
          raw: Json
          sincronizado_em: string
          tipo: string | null
          visivel_cliente: boolean
        }
        Insert: {
          advbox_lawsuit_id: string
          advbox_movement_id: string
          created_at?: string
          data: string
          descricao: string
          id?: string
          organizacao_id: string
          origem?: string
          processo_id: string
          raw?: Json
          sincronizado_em?: string
          tipo?: string | null
          visivel_cliente?: boolean
        }
        Update: {
          advbox_lawsuit_id?: string
          advbox_movement_id?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          organizacao_id?: string
          origem?: string
          processo_id?: string
          raw?: Json
          sincronizado_em?: string
          tipo?: string | null
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "processo_andamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processo_judicial_clientes: {
        Row: {
          cliente_id: string
          organizacao_id: string
          processo_judicial_id: string
        }
        Insert: {
          cliente_id: string
          organizacao_id: string
          processo_judicial_id: string
        }
        Update: {
          cliente_id?: string
          organizacao_id?: string
          processo_judicial_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processo_judicial_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processo_judicial_clientes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processo_judicial_clientes_processo_judicial_id_fkey"
            columns: ["processo_judicial_id"]
            isOneToOne: false
            referencedRelation: "processos_judiciais"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          advbox_lawsuit_id: string | null
          advbox_vinculado_em: string | null
          advbox_vinculado_por: string | null
          cliente_id: string | null
          created_at: string
          dados_fase2: Json | null
          dados_fase3: Json | null
          dados_fase4: Json | null
          dados_fase5: Json | null
          datas_fases: Json
          deleted_at: string | null
          fase_atual: Database["public"]["Enums"]["fase_processo"]
          id: string
          kanban_coluna_id: string | null
          kanban_ordem: number | null
          laudo_id: string
          numero_processo: string | null
          organizacao_id: string | null
          responsaveis_fases: Json
          responsavel_juridico_id: string | null
          status_fases: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          advbox_lawsuit_id?: string | null
          advbox_vinculado_em?: string | null
          advbox_vinculado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          dados_fase2?: Json | null
          dados_fase3?: Json | null
          dados_fase4?: Json | null
          dados_fase5?: Json | null
          datas_fases?: Json
          deleted_at?: string | null
          fase_atual?: Database["public"]["Enums"]["fase_processo"]
          id?: string
          kanban_coluna_id?: string | null
          kanban_ordem?: number | null
          laudo_id: string
          numero_processo?: string | null
          organizacao_id?: string | null
          responsaveis_fases?: Json
          responsavel_juridico_id?: string | null
          status_fases?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          advbox_lawsuit_id?: string | null
          advbox_vinculado_em?: string | null
          advbox_vinculado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          dados_fase2?: Json | null
          dados_fase3?: Json | null
          dados_fase4?: Json | null
          dados_fase5?: Json | null
          datas_fases?: Json
          deleted_at?: string | null
          fase_atual?: Database["public"]["Enums"]["fase_processo"]
          id?: string
          kanban_coluna_id?: string | null
          kanban_ordem?: number | null
          laudo_id?: string
          numero_processo?: string | null
          organizacao_id?: string | null
          responsaveis_fases?: Json
          responsavel_juridico_id?: string | null
          status_fases?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_laudo_id_fkey"
            columns: ["laudo_id"]
            isOneToOne: false
            referencedRelation: "laudos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_judiciais: {
        Row: {
          advbox_criado_em: string | null
          advbox_lawsuit_id: string
          advbox_responsavel_id: string | null
          advbox_responsavel_nome: string | null
          created_at: string
          dados_brutos: Json | null
          etapa: string | null
          fase: string | null
          grupo: string | null
          id: string
          numero_cnj: string | null
          numero_cnj_formatado: string | null
          observacoes: string | null
          organizacao_id: string
          responsavel_user_id: string | null
          sincronizado_em: string
          status_closure_bruto: string | null
          tipo: string | null
        }
        Insert: {
          advbox_criado_em?: string | null
          advbox_lawsuit_id: string
          advbox_responsavel_id?: string | null
          advbox_responsavel_nome?: string | null
          created_at?: string
          dados_brutos?: Json | null
          etapa?: string | null
          fase?: string | null
          grupo?: string | null
          id?: string
          numero_cnj?: string | null
          numero_cnj_formatado?: string | null
          observacoes?: string | null
          organizacao_id: string
          responsavel_user_id?: string | null
          sincronizado_em?: string
          status_closure_bruto?: string | null
          tipo?: string | null
        }
        Update: {
          advbox_criado_em?: string | null
          advbox_lawsuit_id?: string
          advbox_responsavel_id?: string | null
          advbox_responsavel_nome?: string | null
          created_at?: string
          dados_brutos?: Json | null
          etapa?: string | null
          fase?: string | null
          grupo?: string | null
          id?: string
          numero_cnj?: string | null
          numero_cnj_formatado?: string | null
          observacoes?: string | null
          organizacao_id?: string
          responsavel_user_id?: string | null
          sincronizado_em?: string
          status_closure_bruto?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_judiciais_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assinatura_url: string | null
          ativo: boolean
          cargo: string | null
          cidade: string | null
          crea_numero: string | null
          crea_uf: string | null
          created_at: string
          data_entrada: string | null
          especialidade: string | null
          foto_url: string | null
          id: string
          jornada: string | null
          laudos_mes_atual: number
          lider_id: string | null
          nivel: string | null
          nome: string | null
          onboarding_completo: boolean
          plano: string
          regime_trabalho: string | null
          setor: string | null
          subfaixa: string | null
          telefone: string | null
          tipo_vinculo: string | null
          uf: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          assinatura_url?: string | null
          ativo?: boolean
          cargo?: string | null
          cidade?: string | null
          crea_numero?: string | null
          crea_uf?: string | null
          created_at?: string
          data_entrada?: string | null
          especialidade?: string | null
          foto_url?: string | null
          id: string
          jornada?: string | null
          laudos_mes_atual?: number
          lider_id?: string | null
          nivel?: string | null
          nome?: string | null
          onboarding_completo?: boolean
          plano?: string
          regime_trabalho?: string | null
          setor?: string | null
          subfaixa?: string | null
          telefone?: string | null
          tipo_vinculo?: string | null
          uf?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          assinatura_url?: string | null
          ativo?: boolean
          cargo?: string | null
          cidade?: string | null
          crea_numero?: string | null
          crea_uf?: string | null
          created_at?: string
          data_entrada?: string | null
          especialidade?: string | null
          foto_url?: string | null
          id?: string
          jornada?: string | null
          laudos_mes_atual?: number
          lider_id?: string | null
          nivel?: string | null
          nome?: string | null
          onboarding_completo?: boolean
          plano?: string
          regime_trabalho?: string | null
          setor?: string | null
          subfaixa?: string | null
          telefone?: string | null
          tipo_vinculo?: string | null
          uf?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prova_alternativas: {
        Row: {
          correta: boolean
          created_at: string
          id: string
          ordem: number
          organizacao_id: string
          questao_id: string
          texto: string
        }
        Insert: {
          correta?: boolean
          created_at?: string
          id?: string
          ordem?: number
          organizacao_id: string
          questao_id: string
          texto: string
        }
        Update: {
          correta?: boolean
          created_at?: string
          id?: string
          ordem?: number
          organizacao_id?: string
          questao_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "prova_alternativas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "prova_questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      prova_aplicacoes: {
        Row: {
          anonimizada_em: string | null
          aprovado: boolean | null
          candidato_email: string | null
          candidato_nome: string | null
          candidato_telefone: string | null
          corrigida_em: string | null
          corrigida_por: string | null
          created_at: string
          enviada_em: string | null
          id: string
          iniciada_em: string | null
          nota: number | null
          observacao_do_lider: string | null
          organizacao_id: string
          prova_id: string
          status: string
          tentativas_token: number
          token: string | null
          token_expira_em: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anonimizada_em?: string | null
          aprovado?: boolean | null
          candidato_email?: string | null
          candidato_nome?: string | null
          candidato_telefone?: string | null
          corrigida_em?: string | null
          corrigida_por?: string | null
          created_at?: string
          enviada_em?: string | null
          id?: string
          iniciada_em?: string | null
          nota?: number | null
          observacao_do_lider?: string | null
          organizacao_id: string
          prova_id: string
          status?: string
          tentativas_token?: number
          token?: string | null
          token_expira_em?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anonimizada_em?: string | null
          aprovado?: boolean | null
          candidato_email?: string | null
          candidato_nome?: string | null
          candidato_telefone?: string | null
          corrigida_em?: string | null
          corrigida_por?: string | null
          created_at?: string
          enviada_em?: string | null
          id?: string
          iniciada_em?: string | null
          nota?: number | null
          observacao_do_lider?: string | null
          organizacao_id?: string
          prova_id?: string
          status?: string
          tentativas_token?: number
          token?: string | null
          token_expira_em?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prova_aplicacoes_prova_id_fkey"
            columns: ["prova_id"]
            isOneToOne: false
            referencedRelation: "provas"
            referencedColumns: ["id"]
          },
        ]
      }
      prova_questoes: {
        Row: {
          created_at: string
          enunciado: string
          explicacao: string | null
          id: string
          ordem: number
          organizacao_id: string
          peso: number
          prova_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enunciado: string
          explicacao?: string | null
          id?: string
          ordem?: number
          organizacao_id: string
          peso?: number
          prova_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enunciado?: string
          explicacao?: string | null
          id?: string
          ordem?: number
          organizacao_id?: string
          peso?: number
          prova_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prova_questoes_prova_id_fkey"
            columns: ["prova_id"]
            isOneToOne: false
            referencedRelation: "provas"
            referencedColumns: ["id"]
          },
        ]
      }
      prova_respostas: {
        Row: {
          alternativa_id: string | null
          aplicacao_id: string
          created_at: string
          id: string
          organizacao_id: string
          pontos: number | null
          questao_id: string
          resposta_texto: string | null
          updated_at: string
        }
        Insert: {
          alternativa_id?: string | null
          aplicacao_id: string
          created_at?: string
          id?: string
          organizacao_id: string
          pontos?: number | null
          questao_id: string
          resposta_texto?: string | null
          updated_at?: string
        }
        Update: {
          alternativa_id?: string | null
          aplicacao_id?: string
          created_at?: string
          id?: string
          organizacao_id?: string
          pontos?: number | null
          questao_id?: string
          resposta_texto?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prova_respostas_alternativa_id_fkey"
            columns: ["alternativa_id"]
            isOneToOne: false
            referencedRelation: "prova_alternativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prova_respostas_aplicacao_id_fkey"
            columns: ["aplicacao_id"]
            isOneToOne: false
            referencedRelation: "prova_aplicacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prova_respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "prova_questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      provas: {
        Row: {
          cargo_alvo_id: string | null
          created_at: string
          criada_por: string | null
          deleted_at: string | null
          descricao: string | null
          embaralhar_alternativas: boolean
          embaralhar_questoes: boolean
          finalidade: string
          id: string
          nota_minima: number
          organizacao_id: string
          publicada: boolean
          retencao_dias: number
          tempo_limite_min: number | null
          tentativas_permitidas: number
          titulo: string
          trilha_id: string | null
          updated_at: string
        }
        Insert: {
          cargo_alvo_id?: string | null
          created_at?: string
          criada_por?: string | null
          deleted_at?: string | null
          descricao?: string | null
          embaralhar_alternativas?: boolean
          embaralhar_questoes?: boolean
          finalidade?: string
          id?: string
          nota_minima?: number
          organizacao_id: string
          publicada?: boolean
          retencao_dias?: number
          tempo_limite_min?: number | null
          tentativas_permitidas?: number
          titulo: string
          trilha_id?: string | null
          updated_at?: string
        }
        Update: {
          cargo_alvo_id?: string | null
          created_at?: string
          criada_por?: string | null
          deleted_at?: string | null
          descricao?: string | null
          embaralhar_alternativas?: boolean
          embaralhar_questoes?: boolean
          finalidade?: string
          id?: string
          nota_minima?: number
          organizacao_id?: string
          publicada?: boolean
          retencao_dias?: number
          tempo_limite_min?: number | null
          tentativas_permitidas?: number
          titulo?: string
          trilha_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provas_cargo_alvo_id_fkey"
            columns: ["cargo_alvo_id"]
            isOneToOne: false
            referencedRelation: "rh_tabela_salarial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provas_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trein_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_etapas_config: {
        Row: {
          carteira: string
          created_at: string
          id: string
          mapeia: string | null
          organizacao_id: string
          protocola: string | null
          updated_at: string
        }
        Insert: {
          carteira: string
          created_at?: string
          id?: string
          mapeia?: string | null
          organizacao_id: string
          protocola?: string | null
          updated_at?: string
        }
        Update: {
          carteira?: string
          created_at?: string
          id?: string
          mapeia?: string | null
          organizacao_id?: string
          protocola?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      radar_funcoes: {
        Row: {
          created_at: string
          funcao: string
          id: string
          organizacao_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          funcao: string
          id?: string
          organizacao_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          funcao?: string
          id?: string
          organizacao_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          id: string
          window_seconds: number
          window_start: string
        }
        Insert: {
          count?: number
          id: string
          window_seconds?: number
          window_start?: string
        }
        Update: {
          count?: number
          id?: string
          window_seconds?: number
          window_start?: string
        }
        Relationships: []
      }
      relatorios_cliente: {
        Row: {
          cliente_id: string | null
          cliente_nome: string
          conteudo: string
          created_at: string
          gerado_por: string
          id: string
          modelo: string | null
          organizacao_id: string
          provedor: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome: string
          conteudo?: string
          created_at?: string
          gerado_por: string
          id?: string
          modelo?: string | null
          organizacao_id: string
          provedor?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string
          conteudo?: string
          created_at?: string
          gerado_por?: string
          id?: string
          modelo?: string | null
          organizacao_id?: string
          provedor?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rh_apuracoes: {
        Row: {
          ano: number
          aprovado_por: string | null
          bonus_final: number | null
          cota_individual: number | null
          created_at: string
          data_pagamento: string | null
          faixa_termometro: string | null
          feedback_gestor: string | null
          id: string
          membro_id: string
          meta_1_batida: boolean | null
          meta_1_id: string | null
          meta_1_pontos: number | null
          meta_2_batida: boolean | null
          meta_2_id: string | null
          meta_2_pontos: number | null
          meta_3_batida: boolean | null
          meta_3_id: string | null
          meta_3_pontos: number | null
          metas_batidas_total: number | null
          modo_calibracao: boolean | null
          multiplicador_antiguidade: number | null
          multiplicador_base: number | null
          multiplicador_final: number | null
          nivel: string | null
          organizacao_id: string
          peso_nivel: number | null
          pontuacao_total: number | null
          pool_id: string | null
          salario_fixo: number | null
          semestre: string
          setor: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ano: number
          aprovado_por?: string | null
          bonus_final?: number | null
          cota_individual?: number | null
          created_at?: string
          data_pagamento?: string | null
          faixa_termometro?: string | null
          feedback_gestor?: string | null
          id?: string
          membro_id: string
          meta_1_batida?: boolean | null
          meta_1_id?: string | null
          meta_1_pontos?: number | null
          meta_2_batida?: boolean | null
          meta_2_id?: string | null
          meta_2_pontos?: number | null
          meta_3_batida?: boolean | null
          meta_3_id?: string | null
          meta_3_pontos?: number | null
          metas_batidas_total?: number | null
          modo_calibracao?: boolean | null
          multiplicador_antiguidade?: number | null
          multiplicador_base?: number | null
          multiplicador_final?: number | null
          nivel?: string | null
          organizacao_id: string
          peso_nivel?: number | null
          pontuacao_total?: number | null
          pool_id?: string | null
          salario_fixo?: number | null
          semestre: string
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          aprovado_por?: string | null
          bonus_final?: number | null
          cota_individual?: number | null
          created_at?: string
          data_pagamento?: string | null
          faixa_termometro?: string | null
          feedback_gestor?: string | null
          id?: string
          membro_id?: string
          meta_1_batida?: boolean | null
          meta_1_id?: string | null
          meta_1_pontos?: number | null
          meta_2_batida?: boolean | null
          meta_2_id?: string | null
          meta_2_pontos?: number | null
          meta_3_batida?: boolean | null
          meta_3_id?: string | null
          meta_3_pontos?: number | null
          metas_batidas_total?: number | null
          modo_calibracao?: boolean | null
          multiplicador_antiguidade?: number | null
          multiplicador_base?: number | null
          multiplicador_final?: number | null
          nivel?: string | null
          organizacao_id?: string
          peso_nivel?: number | null
          pontuacao_total?: number | null
          pool_id?: string | null
          salario_fixo?: number | null
          semestre?: string
          setor?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_apuracoes_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_apuracoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_apuracoes_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "rh_pools_semestrais"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_contratos: {
        Row: {
          arquivo_url: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          membro_id: string
          observacoes: string | null
          organizacao_id: string
          regime_trabalho: string | null
          status: string
          tipo_vinculo: string
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          id?: string
          membro_id: string
          observacoes?: string | null
          organizacao_id: string
          regime_trabalho?: string | null
          status?: string
          tipo_vinculo?: string
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          membro_id?: string
          observacoes?: string | null
          organizacao_id?: string
          regime_trabalho?: string | null
          status?: string
          tipo_vinculo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_contratos_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_contratos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_documentos: {
        Row: {
          arquivo_url: string | null
          created_at: string
          data_assinatura: string | null
          data_envio: string | null
          id: string
          membro_id: string
          nome: string
          observacoes: string | null
          organizacao_id: string
          status_assinatura: string
          tipo: string
          uploaded_by: string
          validade: string | null
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_envio?: string | null
          id?: string
          membro_id: string
          nome: string
          observacoes?: string | null
          organizacao_id: string
          status_assinatura?: string
          tipo?: string
          uploaded_by: string
          validade?: string | null
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_envio?: string | null
          id?: string
          membro_id?: string
          nome?: string
          observacoes?: string | null
          organizacao_id?: string
          status_assinatura?: string
          tipo?: string
          uploaded_by?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_documentos_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_documentos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_feedbacks: {
        Row: {
          acao_esperada: string | null
          autor_id: string
          comentario: string
          contexto: string | null
          created_at: string
          id: string
          membro_id: string
          nota: number
          organizacao_id: string
          periodo_referencia: string | null
          prazo_revisao: string | null
          status_feedback: string
          tipo: string
        }
        Insert: {
          acao_esperada?: string | null
          autor_id: string
          comentario: string
          contexto?: string | null
          created_at?: string
          id?: string
          membro_id: string
          nota: number
          organizacao_id: string
          periodo_referencia?: string | null
          prazo_revisao?: string | null
          status_feedback?: string
          tipo?: string
        }
        Update: {
          acao_esperada?: string | null
          autor_id?: string
          comentario?: string
          contexto?: string | null
          created_at?: string
          id?: string
          membro_id?: string
          nota?: number
          organizacao_id?: string
          periodo_referencia?: string | null
          prazo_revisao?: string | null
          status_feedback?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_feedbacks_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_feedbacks_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_historico: {
        Row: {
          created_at: string
          criado_por: string
          descricao: string
          id: string
          membro_id: string
          organizacao_id: string
          tipo_evento: string
          visivel_para_colaborador: boolean
        }
        Insert: {
          created_at?: string
          criado_por: string
          descricao: string
          id?: string
          membro_id: string
          organizacao_id: string
          tipo_evento: string
          visivel_para_colaborador?: boolean
        }
        Update: {
          created_at?: string
          criado_por?: string
          descricao?: string
          id?: string
          membro_id?: string
          organizacao_id?: string
          tipo_evento?: string
          visivel_para_colaborador?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rh_historico_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_historico_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_metas: {
        Row: {
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          indicador: string | null
          membro_id: string
          observacoes: string | null
          organizacao_id: string
          percentual_atingimento: number | null
          periodo_fim: string | null
          periodo_inicio: string | null
          prazo: string | null
          progresso: number
          status: string
          tipo_meta: string | null
          titulo: string
          updated_at: string
          valor_atual: number | null
          valor_esperado: number | null
        }
        Insert: {
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          indicador?: string | null
          membro_id: string
          observacoes?: string | null
          organizacao_id: string
          percentual_atingimento?: number | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          prazo?: string | null
          progresso?: number
          status?: string
          tipo_meta?: string | null
          titulo: string
          updated_at?: string
          valor_atual?: number | null
          valor_esperado?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          indicador?: string | null
          membro_id?: string
          observacoes?: string | null
          organizacao_id?: string
          percentual_atingimento?: number | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          prazo?: string | null
          progresso?: number
          status?: string
          tipo_meta?: string | null
          titulo?: string
          updated_at?: string
          valor_atual?: number | null
          valor_esperado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_metas_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_metas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_metas_template: {
        Row: {
          alvo: string
          alvo_calibracao: string | null
          created_at: string
          descricao: string
          fonte: string | null
          id: string
          meta_code: string
          nivel: string
          ordem: number
          organizacao_id: string
          peso_pontuacao: number
          setor: string
          tipo: string
          updated_at: string
        }
        Insert: {
          alvo: string
          alvo_calibracao?: string | null
          created_at?: string
          descricao: string
          fonte?: string | null
          id?: string
          meta_code: string
          nivel: string
          ordem?: number
          organizacao_id: string
          peso_pontuacao?: number
          setor: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          alvo?: string
          alvo_calibracao?: string | null
          created_at?: string
          descricao?: string
          fonte?: string | null
          id?: string
          meta_code?: string
          nivel?: string
          ordem?: number
          organizacao_id?: string
          peso_pontuacao?: number
          setor?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_metas_template_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_pdis: {
        Row: {
          acao_pratica: string | null
          competencia: string | null
          created_at: string
          created_by: string
          evidencia_evolucao: string | null
          id: string
          membro_id: string
          objetivo: string
          organizacao_id: string
          prazo: string | null
          responsavel_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acao_pratica?: string | null
          competencia?: string | null
          created_at?: string
          created_by: string
          evidencia_evolucao?: string | null
          id?: string
          membro_id: string
          objetivo: string
          organizacao_id: string
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acao_pratica?: string | null
          competencia?: string | null
          created_at?: string
          created_by?: string
          evidencia_evolucao?: string | null
          id?: string
          membro_id?: string
          objetivo?: string
          organizacao_id?: string
          prazo?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_pdis_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_pdis_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_playbooks: {
        Row: {
          arquivo_url: string | null
          ativo: boolean
          categoria: string | null
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          organizacao_id: string
          setor: string
          storage_path: string | null
          titulo: string
          updated_at: string
          versao: string | null
        }
        Insert: {
          arquivo_url?: string | null
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          organizacao_id: string
          setor: string
          storage_path?: string | null
          titulo: string
          updated_at?: string
          versao?: string | null
        }
        Update: {
          arquivo_url?: string | null
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          organizacao_id?: string
          setor?: string
          storage_path?: string | null
          titulo?: string
          updated_at?: string
          versao?: string | null
        }
        Relationships: []
      }
      rh_politica_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          id: string
          organizacao_id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value?: Json
          created_at?: string
          id?: string
          organizacao_id: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          id?: string
          organizacao_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_politica_config_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_pools_semestrais: {
        Row: {
          ano: number
          aprovado_por: string | null
          created_at: string
          data_definicao: string | null
          faturamento_semestral: number | null
          gatilho_atingido: boolean | null
          id: string
          meta_faturamento: number | null
          organizacao_id: string
          pool_definido: number | null
          pool_liberado: number | null
          semestre: string
          status: string
          updated_at: string
        }
        Insert: {
          ano: number
          aprovado_por?: string | null
          created_at?: string
          data_definicao?: string | null
          faturamento_semestral?: number | null
          gatilho_atingido?: boolean | null
          id?: string
          meta_faturamento?: number | null
          organizacao_id: string
          pool_definido?: number | null
          pool_liberado?: number | null
          semestre: string
          status?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          aprovado_por?: string | null
          created_at?: string
          data_definicao?: string | null
          faturamento_semestral?: number | null
          gatilho_atingido?: boolean | null
          id?: string
          meta_faturamento?: number | null
          organizacao_id?: string
          pool_definido?: number | null
          pool_liberado?: number | null
          semestre?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_pools_semestrais_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_regimentos: {
        Row: {
          arquivo_url: string | null
          ativo: boolean
          categoria: string | null
          created_at: string
          created_by: string
          descricao: string | null
          id: string
          organizacao_id: string
          storage_path: string | null
          titulo: string
          updated_at: string
          versao: string | null
        }
        Insert: {
          arquivo_url?: string | null
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          created_by: string
          descricao?: string | null
          id?: string
          organizacao_id: string
          storage_path?: string | null
          titulo: string
          updated_at?: string
          versao?: string | null
        }
        Update: {
          arquivo_url?: string | null
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          id?: string
          organizacao_id?: string
          storage_path?: string | null
          titulo?: string
          updated_at?: string
          versao?: string | null
        }
        Relationships: []
      }
      rh_reunioes_1on1: {
        Row: {
          anotacoes: string | null
          condutor_id: string
          created_at: string
          data_reuniao: string
          dificuldades: string | null
          id: string
          membro_id: string
          nota_interna_admin: string | null
          organizacao_id: string
          pauta: string | null
          prazo_revisao: string | null
          proximos_passos: string | null
          resumo_visivel_colaborador: string | null
          status_reuniao: string
          vitorias: string | null
        }
        Insert: {
          anotacoes?: string | null
          condutor_id: string
          created_at?: string
          data_reuniao: string
          dificuldades?: string | null
          id?: string
          membro_id: string
          nota_interna_admin?: string | null
          organizacao_id: string
          pauta?: string | null
          prazo_revisao?: string | null
          proximos_passos?: string | null
          resumo_visivel_colaborador?: string | null
          status_reuniao?: string
          vitorias?: string | null
        }
        Update: {
          anotacoes?: string | null
          condutor_id?: string
          created_at?: string
          data_reuniao?: string
          dificuldades?: string | null
          id?: string
          membro_id?: string
          nota_interna_admin?: string | null
          organizacao_id?: string
          pauta?: string | null
          prazo_revisao?: string | null
          proximos_passos?: string | null
          resumo_visivel_colaborador?: string | null
          status_reuniao?: string
          vitorias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_reunioes_1on1_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_reunioes_1on1_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_salarios: {
        Row: {
          created_at: string
          created_by: string
          data_vigencia: string
          id: string
          membro_id: string
          motivo: string | null
          organizacao_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          created_by: string
          data_vigencia: string
          id?: string
          membro_id: string
          motivo?: string | null
          organizacao_id: string
          valor: number
        }
        Update: {
          created_at?: string
          created_by?: string
          data_vigencia?: string
          id?: string
          membro_id?: string
          motivo?: string | null
          organizacao_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_salarios_membro_id_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_salarios_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_tabela_salarial: {
        Row: {
          created_at: string
          id: string
          nivel: string
          organizacao_id: string
          sal_max: number
          sal_min: number
          setor: string
          subfaixa: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nivel: string
          organizacao_id: string
          sal_max?: number
          sal_min?: number
          setor: string
          subfaixa?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nivel?: string
          organizacao_id?: string
          sal_max?: number
          sal_min?: number
          setor?: string
          subfaixa?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_tabela_salarial_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          institucional: boolean
          nome: string
          ordem: number
          organizacao_id: string
          pai_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          institucional?: boolean
          nome: string
          ordem?: number
          organizacao_id: string
          pai_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          institucional?: boolean
          nome?: string
          ordem?: number
          organizacao_id?: string
          pai_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setores_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setores_pai_id_fkey"
            columns: ["pai_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      sheets_sync_config: {
        Row: {
          column_mapping: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          sheet_name: string | null
          spreadsheet_url: string
          sync_interval_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          sheet_name?: string | null
          spreadsheet_url: string
          sync_interval_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          sheet_name?: string | null
          spreadsheet_url?: string
          sync_interval_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tarefa_comentarios: {
        Row: {
          created_at: string
          id: string
          tarefa_id: string
          texto: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tarefa_id: string
          texto: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tarefa_id?: string
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          concluida: boolean
          created_at: string
          created_by: string
          data_vencimento: string
          descricao: string | null
          fase: Database["public"]["Enums"]["fase_processo"] | null
          id: string
          nome_cliente: string | null
          organizacao_id: string
          prioridade: string
          processo_id: string | null
          responsavel_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          concluida?: boolean
          created_at?: string
          created_by: string
          data_vencimento: string
          descricao?: string | null
          fase?: Database["public"]["Enums"]["fase_processo"] | null
          id?: string
          nome_cliente?: string | null
          organizacao_id: string
          prioridade?: string
          processo_id?: string | null
          responsavel_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          concluida?: boolean
          created_at?: string
          created_by?: string
          data_vencimento?: string
          descricao?: string | null
          fase?: Database["public"]["Enums"]["fase_processo"] | null
          id?: string
          nome_cliente?: string | null
          organizacao_id?: string
          prioridade?: string
          processo_id?: string | null
          responsavel_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_historico: {
        Row: {
          acao: string
          created_at: string
          data_acao: string
          data_vencimento_original: string | null
          descricao: string | null
          executado_por: string
          fase: string | null
          id: string
          nome_cliente: string | null
          organizacao_id: string
          prioridade: string | null
          processo_id: string | null
          responsavel_id: string
          tarefa_id: string | null
          titulo: string
        }
        Insert: {
          acao?: string
          created_at?: string
          data_acao?: string
          data_vencimento_original?: string | null
          descricao?: string | null
          executado_por: string
          fase?: string | null
          id?: string
          nome_cliente?: string | null
          organizacao_id: string
          prioridade?: string | null
          processo_id?: string | null
          responsavel_id: string
          tarefa_id?: string | null
          titulo: string
        }
        Update: {
          acao?: string
          created_at?: string
          data_acao?: string
          data_vencimento_original?: string | null
          descricao?: string | null
          executado_por?: string
          fase?: string | null
          id?: string
          nome_cliente?: string | null
          organizacao_id?: string
          prioridade?: string | null
          processo_id?: string | null
          responsavel_id?: string
          tarefa_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_historico_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_conclusao: {
        Row: {
          conteudo: string
          created_at: string
          hipotese_mcr: string | null
          id: string
          is_favorito: boolean
          is_sistema: boolean
          nome: string
          user_id: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string
          hipotese_mcr?: string | null
          id?: string
          is_favorito?: boolean
          is_sistema?: boolean
          nome: string
          user_id?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string
          hipotese_mcr?: string | null
          id?: string
          is_favorito?: boolean
          is_sistema?: boolean
          nome?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tj_auditoria: {
        Row: {
          acao: string
          created_at: string
          credencial_id: string | null
          credencial_nome: string | null
          detalhe: Json | null
          id: number
          ip: string | null
          organizacao_id: string | null
          sucesso: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          credencial_id?: string | null
          credencial_nome?: string | null
          detalhe?: Json | null
          id?: number
          ip?: string | null
          organizacao_id?: string | null
          sucesso?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          credencial_id?: string | null
          credencial_nome?: string | null
          detalhe?: Json | null
          id?: number
          ip?: string | null
          organizacao_id?: string | null
          sucesso?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tj_credenciais: {
        Row: {
          algoritmo: string
          ativo: boolean
          created_at: string
          criado_por: string | null
          descricao: string | null
          digitos: number
          id: string
          nome: string
          organizacao_id: string
          periodo: number
          segredo_cifrado: string
          updated_at: string
        }
        Insert: {
          algoritmo?: string
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          digitos?: number
          id?: string
          nome: string
          organizacao_id: string
          periodo?: number
          segredo_cifrado: string
          updated_at?: string
        }
        Update: {
          algoritmo?: string
          ativo?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          digitos?: number
          id?: string
          nome?: string
          organizacao_id?: string
          periodo?: number
          segredo_cifrado?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tj_credenciais_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      tj_credencial_acessos: {
        Row: {
          concedido_por: string | null
          created_at: string
          credencial_id: string
          id: string
          user_id: string
        }
        Insert: {
          concedido_por?: string | null
          created_at?: string
          credencial_id: string
          id?: string
          user_id: string
        }
        Update: {
          concedido_por?: string | null
          created_at?: string
          credencial_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tj_credencial_acessos_credencial_id_fkey"
            columns: ["credencial_id"]
            isOneToOne: false
            referencedRelation: "tj_credenciais"
            referencedColumns: ["id"]
          },
        ]
      }
      tj_custodiantes: {
        Row: {
          created_at: string
          id: string
          observacao: string | null
          organizacao_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          observacao?: string | null
          organizacao_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          observacao?: string | null
          organizacao_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tj_custodiantes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      trein_atribuicoes: {
        Row: {
          atribuida_em: string
          aviso_3d_enviado: boolean
          concluida_em: string | null
          id: string
          nota_final: number | null
          obrigatoria: boolean
          organizacao_id: string
          origem: string
          prazo_em: string | null
          reiniciada_em: string
          status: string
          trilha_id: string
          user_id: string
          versao: number
        }
        Insert: {
          atribuida_em?: string
          aviso_3d_enviado?: boolean
          concluida_em?: string | null
          id?: string
          nota_final?: number | null
          obrigatoria?: boolean
          organizacao_id: string
          origem?: string
          prazo_em?: string | null
          reiniciada_em?: string
          status?: string
          trilha_id: string
          user_id: string
          versao?: number
        }
        Update: {
          atribuida_em?: string
          aviso_3d_enviado?: boolean
          concluida_em?: string | null
          id?: string
          nota_final?: number | null
          obrigatoria?: boolean
          organizacao_id?: string
          origem?: string
          prazo_em?: string | null
          reiniciada_em?: string
          status?: string
          trilha_id?: string
          user_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "trein_atribuicoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_atribuicoes_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trein_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trein_aula_progresso: {
        Row: {
          aula_id: string
          checklist_marcados: Json
          concluida_em: string | null
          id: string
          organizacao_id: string
          trilha_id: string
          user_id: string
        }
        Insert: {
          aula_id: string
          checklist_marcados?: Json
          concluida_em?: string | null
          id?: string
          organizacao_id: string
          trilha_id: string
          user_id?: string
        }
        Update: {
          aula_id?: string
          checklist_marcados?: Json
          concluida_em?: string | null
          id?: string
          organizacao_id?: string
          trilha_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trein_aula_progresso_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "trein_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_aula_progresso_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_aula_progresso_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trein_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trein_aulas: {
        Row: {
          checklist_itens: Json
          conteudo_html: string | null
          conteudo_md: string | null
          created_at: string
          id: string
          minutos_estimados: number | null
          modulo_id: string
          ordem: number
          organizacao_id: string
          prova_de_saida: string | null
          storage_path: string | null
          tipo: string
          titulo: string
          trilha_id: string
          url: string | null
        }
        Insert: {
          checklist_itens?: Json
          conteudo_html?: string | null
          conteudo_md?: string | null
          created_at?: string
          id?: string
          minutos_estimados?: number | null
          modulo_id: string
          ordem?: number
          organizacao_id: string
          prova_de_saida?: string | null
          storage_path?: string | null
          tipo: string
          titulo: string
          trilha_id: string
          url?: string | null
        }
        Update: {
          checklist_itens?: Json
          conteudo_html?: string | null
          conteudo_md?: string | null
          created_at?: string
          id?: string
          minutos_estimados?: number | null
          modulo_id?: string
          ordem?: number
          organizacao_id?: string
          prova_de_saida?: string | null
          storage_path?: string | null
          tipo?: string
          titulo?: string
          trilha_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trein_aulas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "trein_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_aulas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_aulas_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trein_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trein_modulos: {
        Row: {
          created_at: string
          id: string
          ordem: number
          organizacao_id: string
          titulo: string
          trilha_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          organizacao_id: string
          titulo: string
          trilha_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          organizacao_id?: string
          titulo?: string
          trilha_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trein_modulos_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_modulos_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trein_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trein_perguntas: {
        Row: {
          alternativas: Json
          created_at: string
          enunciado: string
          id: string
          indice_correto: number
          ordem: number
          organizacao_id: string
          questionario_id: string
          trilha_id: string
        }
        Insert: {
          alternativas?: Json
          created_at?: string
          enunciado: string
          id?: string
          indice_correto?: number
          ordem?: number
          organizacao_id: string
          questionario_id: string
          trilha_id: string
        }
        Update: {
          alternativas?: Json
          created_at?: string
          enunciado?: string
          id?: string
          indice_correto?: number
          ordem?: number
          organizacao_id?: string
          questionario_id?: string
          trilha_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trein_perguntas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_perguntas_questionario_id_fkey"
            columns: ["questionario_id"]
            isOneToOne: false
            referencedRelation: "trein_questionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_perguntas_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trein_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trein_questionarios: {
        Row: {
          created_at: string
          id: string
          modulo_id: string
          nota_minima: number
          organizacao_id: string
          trilha_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          modulo_id: string
          nota_minima?: number
          organizacao_id: string
          trilha_id: string
        }
        Update: {
          created_at?: string
          id?: string
          modulo_id?: string
          nota_minima?: number
          organizacao_id?: string
          trilha_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trein_questionarios_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: true
            referencedRelation: "trein_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_questionarios_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_questionarios_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trein_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trein_tentativas: {
        Row: {
          criado_em: string
          id: string
          nota: number
          organizacao_id: string
          questionario_id: string
          respostas: Json
          trilha_id: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          nota: number
          organizacao_id: string
          questionario_id: string
          respostas?: Json
          trilha_id: string
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          nota?: number
          organizacao_id?: string
          questionario_id?: string
          respostas?: Json
          trilha_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trein_tentativas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_tentativas_questionario_id_fkey"
            columns: ["questionario_id"]
            isOneToOne: false
            referencedRelation: "trein_questionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_tentativas_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trein_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trein_trilha_versoes: {
        Row: {
          exige_refazer: boolean
          id: string
          nota: string | null
          organizacao_id: string
          publicada_em: string
          publicada_por: string | null
          trilha_id: string
          versao: number
        }
        Insert: {
          exige_refazer?: boolean
          id?: string
          nota?: string | null
          organizacao_id: string
          publicada_em?: string
          publicada_por?: string | null
          trilha_id: string
          versao: number
        }
        Update: {
          exige_refazer?: boolean
          id?: string
          nota?: string | null
          organizacao_id?: string
          publicada_em?: string
          publicada_por?: string | null
          trilha_id?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "trein_trilha_versoes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_trilha_versoes_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trein_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      trein_trilhas: {
        Row: {
          arquivada: boolean
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          obrigatoria: boolean
          organizacao_id: string
          prazo_dias: number | null
          publicada: boolean
          setor_id: string
          titulo: string
          updated_at: string
          versao: number
        }
        Insert: {
          arquivada?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          obrigatoria?: boolean
          organizacao_id: string
          prazo_dias?: number | null
          publicada?: boolean
          setor_id: string
          titulo: string
          updated_at?: string
          versao?: number
        }
        Update: {
          arquivada?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          obrigatoria?: boolean
          organizacao_id?: string
          prazo_dias?: number | null
          publicada?: boolean
          setor_id?: string
          titulo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "trein_trilhas_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trein_trilhas_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          last_seen_at: string
          organizacao_id: string | null
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          organizacao_id?: string | null
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          last_seen_at?: string
          organizacao_id?: string | null
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      varredura_sugestoes: {
        Row: {
          aplicado_em: string | null
          aplicado_nome: string | null
          aplicado_por: string | null
          arquivo: string | null
          cliente_id: string | null
          cliente_nome: string
          codigo: string | null
          data: string | null
          descartado_motivo: string | null
          id: string
          importado_em: string
          operacao_id: string | null
          organizacao_id: string
          responsavel: string | null
          status: string
          tipo: string
          valor: string | null
          variantes: string[]
          vezes: number
        }
        Insert: {
          aplicado_em?: string | null
          aplicado_nome?: string | null
          aplicado_por?: string | null
          arquivo?: string | null
          cliente_id?: string | null
          cliente_nome: string
          codigo?: string | null
          data?: string | null
          descartado_motivo?: string | null
          id?: string
          importado_em?: string
          operacao_id?: string | null
          organizacao_id: string
          responsavel?: string | null
          status?: string
          tipo: string
          valor?: string | null
          variantes?: string[]
          vezes?: number
        }
        Update: {
          aplicado_em?: string | null
          aplicado_nome?: string | null
          aplicado_por?: string | null
          arquivo?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          codigo?: string | null
          data?: string | null
          descartado_motivo?: string | null
          id?: string
          importado_em?: string
          operacao_id?: string | null
          organizacao_id?: string
          responsavel?: string | null
          status?: string
          tipo?: string
          valor?: string | null
          variantes?: string[]
          vezes?: number
        }
        Relationships: [
          {
            foreignKeyName: "varredura_sugestoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "varredura_sugestoes_operacao_id_fkey"
            columns: ["operacao_id"]
            isOneToOne: false
            referencedRelation: "operacoes_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_tarefas: {
        Row: {
          atendimento_id: string | null
          cliente_id: string | null
          cliente_nome: string | null
          concluida: boolean
          concluida_em: string | null
          concluida_por: string | null
          created_at: string
          created_by: string
          descricao: string | null
          fase: string
          id: string
          laudo_id: string | null
          lead_id: string | null
          metadata: Json
          onboarding_id: string | null
          organizacao_id: string
          prazo: string | null
          responsavel_id: string
          status: string
          tarefa_origem_id: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          atendimento_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          concluida?: boolean
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          created_by: string
          descricao?: string | null
          fase: string
          id?: string
          laudo_id?: string | null
          lead_id?: string | null
          metadata?: Json
          onboarding_id?: string | null
          organizacao_id: string
          prazo?: string | null
          responsavel_id: string
          status?: string
          tarefa_origem_id?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          atendimento_id?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          concluida?: boolean
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          fase?: string
          id?: string
          laudo_id?: string | null
          lead_id?: string | null
          metadata?: Json
          onboarding_id?: string | null
          organizacao_id?: string
          prazo?: string | null
          responsavel_id?: string
          status?: string
          tarefa_origem_id?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      portal_cliente_acordos_view: {
        Row: {
          cliente_id: string | null
          concluida: boolean | null
          created_at: string | null
          data_vencimento: string | null
          descricao: string | null
          id: string | null
          observacoes: string | null
          status: string | null
          titulo: string | null
        }
        Insert: {
          cliente_id?: string | null
          concluida?: boolean | null
          created_at?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string | null
          observacoes?: string | null
          status?: string | null
          titulo?: string | null
        }
        Update: {
          cliente_id?: string | null
          concluida?: boolean | null
          created_at?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string | null
          observacoes?: string | null
          status?: string | null
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acordos_tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_cliente_atendimentos_view: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          id: string | null
          origem: string | null
          relatorio_cliente: string | null
          status: string | null
          tipo_contato: string | null
          titulo: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          id?: string | null
          origem?: string | null
          relatorio_cliente?: string | null
          status?: string | null
          tipo_contato?: string | null
          titulo?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          id?: string | null
          origem?: string | null
          relatorio_cliente?: string | null
          status?: string | null
          tipo_contato?: string | null
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_notas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_cliente_contratos_view: {
        Row: {
          banco: string | null
          cliente_id: string | null
          created_at: string | null
          data_notificacao: string | null
          id: string | null
          numero_contrato: string | null
          parcelas_vencidas: boolean | null
          primeiro_vencimento: string | null
          protocolo_realizado: boolean | null
          resolvido: boolean | null
          updated_at: string | null
          valor_parcela: number | null
          valor_total_operacao: number | null
          vencimento_proxima_parcela: string | null
          vencimento_ultima_parcela: string | null
        }
        Insert: {
          banco?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_notificacao?: string | null
          id?: string | null
          numero_contrato?: string | null
          parcelas_vencidas?: never
          primeiro_vencimento?: string | null
          protocolo_realizado?: never
          resolvido?: never
          updated_at?: string | null
          valor_parcela?: number | null
          valor_total_operacao?: number | null
          vencimento_proxima_parcela?: string | null
          vencimento_ultima_parcela?: string | null
        }
        Update: {
          banco?: string | null
          cliente_id?: string | null
          created_at?: string | null
          data_notificacao?: string | null
          id?: string | null
          numero_contrato?: string | null
          parcelas_vencidas?: never
          primeiro_vencimento?: string | null
          protocolo_realizado?: never
          resolvido?: never
          updated_at?: string | null
          valor_parcela?: number | null
          valor_total_operacao?: number | null
          vencimento_proxima_parcela?: string | null
          vencimento_ultima_parcela?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_vencimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_empresa_plano_view: {
        Row: {
          avenca_id: string | null
          dia_vencimento: number | null
          empresa_id: string | null
          escopo_areas: string[] | null
          status: string | null
          titulo: string | null
          valor_mensal: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avencas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas_consultoria"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_ofertas_view: {
        Row: {
          descricao: string | null
          id: string | null
          marca: string | null
          modo: string | null
          modo_contratacao: string | null
          preco_exibido: number | null
          titulo: string | null
        }
        Relationships: []
      }
      profiles_publico: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          data_entrada: string | null
          foto_url: string | null
          id: string | null
          lider_id: string | null
          nome: string | null
          regime_trabalho: string | null
          setor: string | null
          unidade: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          data_entrada?: string | null
          foto_url?: string | null
          id?: string | null
          lider_id?: string | null
          nome?: string | null
          regime_trabalho?: string | null
          setor?: string | null
          unidade?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          data_entrada?: string | null
          foto_url?: string | null
          id?: string | null
          lider_id?: string | null
          nome?: string | null
          regime_trabalho?: string | null
          setor?: string | null
          unidade?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      advbox_fmt_doc: { Args: { _d: string }; Returns: string }
      advbox_importar_clientes: {
        Args: { _dados: Json; _org: string; _teste?: boolean; _user: string }
        Returns: Json
      }
      advbox_importar_processos: {
        Args: { _dados: Json; _org: string }
        Returns: Json
      }
      audit_dangerous_policies: {
        Args: never
        Returns: {
          cmd: string
          kind: string
          policyname: string
          qual: string
          reason: string
          roles: string[]
          schemaname: string
          tablename: string
          with_check: string
        }[]
      }
      can_view_consultoria_financeiro: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: { _key: string; _max_requests?: number; _window_seconds?: number }
        Returns: boolean
      }
      cliente_do_usuario_portal: { Args: { uid: string }; Returns: string }
      controladoria_is_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      controladoria_is_internal: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      controladoria_triagem_desfazer: {
        Args: { _lote: string }
        Returns: number
      }
      controladoria_triagem_lote: {
        Args: { _acao: string; _ids: string[]; _payload?: Json }
        Returns: string
      }
      empresa_do_usuario_portal: { Args: { uid: string }; Returns: string }
      ensure_cliente_cadastrado: {
        Args: { _nome: string; _org_id: string; _user_id: string }
        Returns: string
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      fn_criar_tarefa_mensal_sdr_leads: { Args: never; Returns: undefined }
      fn_radar_regra_historico: { Args: never; Returns: number }
      fundir_clientes: {
        Args: { _absorver: string; _manter: string; _motivo: string }
        Returns: undefined
      }
      gerar_numero_proposta_honorarios: { Args: never; Returns: string }
      get_proximos_vencimentos_kanban: {
        Args: never
        Returns: {
          banco: string
          cliente: string
          data: string
          dias_restantes: number
          observacao: string
          organizacao_id: string
          origem: string
          processo_id: string
          ref_id: string
        }[]
      }
      has_comercial_access: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      has_marketing_access: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_org: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_in_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_ceo: { Args: { uid: string }; Returns: boolean }
      is_conversa_admin: {
        Args: { _conversa_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversa_member: {
        Args: { _conversa_id: string; _user_id: string }
        Returns: boolean
      }
      is_leader_of_member: {
        Args: { _membro_id: string; _user_id: string }
        Returns: boolean
      }
      is_member_anywhere: { Args: { _user_id: string }; Returns: boolean }
      is_own_member: {
        Args: { _membro_id: string; _user_id: string }
        Returns: boolean
      }
      kanban_seed_default_columns: {
        Args: { _org_id: string }
        Returns: undefined
      }
      match_olivia_conhecimento: {
        Args: {
          filter_categoria?: string
          filter_org?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          categoria: string
          conteudo: string
          fonte: string
          id: string
          metadata: Json
          similarity: number
          tags: string[]
          titulo: string
        }[]
      }
      mkt_dashboard_agregado: {
        Args: { p_fim: string; p_inicio: string; p_nichos?: string[] }
        Returns: Json
      }
      normalize_person_name: { Args: { _input: string }; Returns: string }
      normalize_search: { Args: { "": string }; Returns: string }
      papel_radar: {
        Args: { _org_id: string; _user_id: string }
        Returns: string
      }
      pode_protocolar: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      prova_anonimizar_candidatos: { Args: { _org?: string }; Returns: number }
      prova_is_lider: { Args: { _org: string; _uid: string }; Returns: boolean }
      saude_sistema: {
        Args: never
        Returns: {
          chave: string
          detalhes: Json
          titulo: string
          total: number
        }[]
      }
      search_clientes_norm: {
        Args: { q: string }
        Returns: {
          advbox_customers_id: string | null
          aguardando_distribuicao: boolean
          area_hectares: number | null
          base_historica_advbox: boolean
          cadastrado_em: string
          cadastrado_por: string | null
          cep: string | null
          cpf_cnpj: string | null
          cpf_observacao: string | null
          cpf_origem: string | null
          cpf_origem_em: string | null
          created_at: string
          cultura_principal: string | null
          deleted_at: string | null
          email: string | null
          encerramento_comunicado_arquivo: string | null
          encerramento_comunicado_canal: string | null
          encerramento_comunicado_em: string | null
          encerramento_comunicado_por: string | null
          encerramento_comunicado_registrado_em: string | null
          endereco: string | null
          estado_civil: string | null
          grafias_alternativas: string[] | null
          grupo: string | null
          id: string
          municipio: string | null
          nacionalidade: string | null
          nome: string
          nome_propriedade: string | null
          nps: number | null
          observacoes: string | null
          organizacao_id: string | null
          orgao_emissor: string | null
          profissao: string | null
          responsavel_pos_venda: string | null
          rg: string | null
          risco: string | null
          situacao: string
          situacao_alterada_em: string | null
          situacao_alterada_por: string | null
          situacao_motivo: string | null
          status_adimplencia: string
          telefone: string | null
          triado_em: string | null
          triagem_origem: string | null
          uf: string | null
          updated_at: string
          user_id: string
          vip: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "clientes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_contratos_clientes_norm: {
        Args: { q: string }
        Returns: {
          banco: string
          nome_cliente: string
          numero_contrato: string
        }[]
      }
      search_laudos_by_produtor_norm: {
        Args: { q: string }
        Returns: {
          created_at: string
          dados_etapa1: Json | null
          dados_etapa2: Json | null
          dados_etapa3: Json | null
          dados_etapa4: Json | null
          dados_etapa5: Json | null
          dados_etapa6: Json | null
          deleted_at: string | null
          etapa_desde: string
          finalizado_em: string | null
          hipoteses_selecionadas: string[] | null
          id: string
          numero_laudo: string
          observacao: string | null
          organizacao_id: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["laudo_status"]
          texto_analise_narrativa: string | null
          texto_conclusao: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "laudos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      shares_org: {
        Args: { _user_a: string; _user_b: string }
        Returns: boolean
      }
      soft_delete: { Args: { _id: string; _table: string }; Returns: undefined }
      tem_codigos_tribunais: { Args: never; Returns: boolean }
      trein_acompanha: {
        Args: { _alvo: string; _org: string; _uid: string }
        Returns: boolean
      }
      trein_atribuir: {
        Args: { _origem: string; _trilha: string; _uid: string }
        Returns: boolean
      }
      trein_is_admin: { Args: { _org: string; _uid: string }; Returns: boolean }
      trein_is_gestor: {
        Args: { _org: string; _uid: string }
        Returns: boolean
      }
      trein_is_internal: {
        Args: { _org: string; _uid: string }
        Returns: boolean
      }
      trein_lembretes: { Args: never; Returns: number }
      trein_meu_papel: { Args: never; Returns: Json }
      trein_notificar: {
        Args: { _msg: string; _uid: string }
        Returns: undefined
      }
      trein_papel_de: { Args: { _user: string }; Returns: Json }
      trein_pode_editar_setor: {
        Args: { _setor: string; _uid: string }
        Returns: boolean
      }
      trein_pode_editar_trilha: {
        Args: { _trilha: string; _uid: string }
        Returns: boolean
      }
      trein_pode_ver_trilha: {
        Args: { _trilha: string; _uid: string }
        Returns: boolean
      }
      trein_publicar: {
        Args: { _exige_refazer: boolean; _nota: string; _trilha: string }
        Returns: Json
      }
      trein_publico_trilha: { Args: { _trilha: string }; Returns: string[] }
      trein_quiz_perguntas: { Args: { _questionario: string }; Returns: Json }
      trein_quiz_responder: {
        Args: { _questionario: string; _respostas: Json }
        Returns: Json
      }
      trein_recalcular: {
        Args: { _trilha: string; _uid: string }
        Returns: undefined
      }
      trein_setores_visiveis: { Args: { _uid: string }; Returns: string[] }
      trein_uuid_seguro: { Args: { _t: string }; Returns: string }
      user_has_setor_access: {
        Args: { _org_id: string; _setor: string; _user_id: string }
        Returns: boolean
      }
      user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      valida_cpf: { Args: { _cpf: string }; Returns: boolean }
      ver_como_pode: { Args: { _alvo: string }; Returns: string }
      ver_como_registrar: { Args: { _alvo: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "agronomo"
        | "advogado"
        | "admin"
        | "engenheiro_agronomo"
        | "estagiario_direito"
        | "assessor_juridico"
        | "pos_venda"
        | "coordenador"
        | "marketing"
        | "comercial"
        | "closer"
        | "sdr"
        | "social_seller"
        | "gerente_marketing"
        | "criacao"
        | "copywriter"
        | "social_media"
        | "setor_acordos"
        | "gestor_pos_venda"
        | "advogado_pos_venda"
        | "estagiario_pos_venda"
      fase_processo: "1" | "2" | "3" | "4" | "5"
      laudo_status:
        | "rascunho"
        | "pendente"
        | "analise"
        | "revisao"
        | "finalizado"
        | "retificacao"
        | "exportado"
      status_fase: "pendente" | "em_andamento" | "concluida" | "bloqueada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "agronomo",
        "advogado",
        "admin",
        "engenheiro_agronomo",
        "estagiario_direito",
        "assessor_juridico",
        "pos_venda",
        "coordenador",
        "marketing",
        "comercial",
        "closer",
        "sdr",
        "social_seller",
        "gerente_marketing",
        "criacao",
        "copywriter",
        "social_media",
        "setor_acordos",
        "gestor_pos_venda",
        "advogado_pos_venda",
        "estagiario_pos_venda",
      ],
      fase_processo: ["1", "2", "3", "4", "5"],
      laudo_status: [
        "rascunho",
        "pendente",
        "analise",
        "revisao",
        "finalizado",
        "retificacao",
        "exportado",
      ],
      status_fase: ["pendente", "em_andamento", "concluida", "bloqueada"],
    },
  },
} as const

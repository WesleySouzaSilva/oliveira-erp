UPDATE public.operacoes_credito
SET deleted_at = NULL,
    duplicata_status = NULL,
    duplicata_motivo = NULL,
    duplicata_de = NULL,
    alteracao_motivo = 'restaurada: nao havia gemea ativa - vinculada a Odanir Cristiano Montag',
    cliente_id = 'af1c0521-b1b9-496b-9472-47b1999ae7af',
    titular_nome = 'Odanir Cristiano Montag',
    titular_a_definir = false,
    status_conferencia = 'sem_vencimento',
    data_conferida = false,
    updated_at = now()
WHERE id IN ('7b8024ba-6117-4cd8-b057-1c4dc7080dd9','198cc855-6138-462d-92c5-d8c103cd36fd');
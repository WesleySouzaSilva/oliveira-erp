-- guarda o número anterior e grava o número correto da cédula
UPDATE public.operacoes_credito SET numero_anterior = coalesce(nullif(numero,''), numero_anterior), numero = v.novo, numero_invalido = false, updated_at = now()
FROM (VALUES
 ('f9ae40fe-a3c0-4a06-b9b1-98d92d8b60b2'::uuid,'2945450'),
 ('31595bc8-c9f6-4e50-9fde-f100b6b7a3e4'::uuid,'44011516811'),
 ('35229f4b-15a6-426a-bb45-7261d1cae9c1'::uuid,'254220350112'),
 ('33d7c3a7-4464-4bba-9b72-8fabfb534b07'::uuid,'2253771'),
 ('187dd453-6b85-4d1c-ad5b-5bb5ee921721'::uuid,'2253771'),
 ('517a2100-7df2-46ad-8047-e812816f9d1d'::uuid,'2294496'),
 ('475f40b6-8289-44f9-b989-65dacd533272'::uuid,'238800301552'),
 ('5c3367d6-bd4a-441c-8c85-5c1f52f48285'::uuid,'238800301676'),
 ('6c8fed81-e8ec-489e-bd5b-ee78081c069a'::uuid,'179109282'),
 ('6f27f930-10ef-4e1a-845c-b23d90c7453b'::uuid,'2508968'),
 ('b5cb2bab-04ea-4a5d-b3b7-b91640b99ec7'::uuid,'1636695'),
 ('cb96204e-c36e-41e8-b64e-59cbdf4b5422'::uuid,'2365035'),
 ('730cac43-7373-4d8c-a770-197e230afe4f'::uuid,'0005001256')
) AS v(id, novo)
WHERE operacoes_credito.id = v.id;

-- CDC de crédito automático: não alongável
UPDATE public.operacoes_credito
SET dispensar_alerta = true, dispensa_motivo = 'não alongável - CDC de crédito automático', updated_at = now()
WHERE id = '6c8fed81-e8ec-489e-bd5b-ee78081c069a';
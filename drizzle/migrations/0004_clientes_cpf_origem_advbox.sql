ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cpf_origem text,
  ADD COLUMN IF NOT EXISTS cpf_origem_em timestamptz;

update clientes set cpf_cnpj='071.455.749-85', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='35abaa22-d468-4041-9e3b-ee1fb78492e6' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='303.725.699-00', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='93dca245-2a70-411b-a5e5-1068219060f6' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='346.840.509-04', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='5a2265c7-a88d-4ef1-a9ab-10b21edf700e' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='571.876.069-15', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='3f80fcd0-edc0-4d83-8109-5ad950092bfb' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='059.625.619-10', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='aa3c6105-5cdc-42fb-aef2-8908aea28e81' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='064.321.069-58', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='c28d5e73-a9a3-4fc2-954d-88460d151cc7' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='532.448.341-91', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='dde9214c-3152-4fb3-a9a0-58f4ff97fab4' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='747.224.929-72', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='c03c2c5f-3c24-4ec3-84f2-0bb6105f7bbd' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='104.957.541-53', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='98afeef3-6ad3-4105-918e-67d90ac6e577' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='069.805.909-36', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='5627a3e4-83a7-42e0-88af-2c890ce8786b' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='204.641.692-91', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='98bf0d1e-d5c1-455e-b7ee-6441a3dbe345' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='017.397.579-80', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='94ca2910-1e4f-4edb-922b-c2ee458f10d1' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='128.307.168-17', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='d452ec99-1e13-4d36-b7d0-9cce3713bf4e' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='027.518.929-57', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='0a4f8a2d-75c9-4f65-abd4-0880815a0614' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='119.901.749-30', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='64295a54-b6d5-4da3-a14b-ee64f0bf7dda' and coalesce(cpf_cnpj,'')='';
update clientes set cpf_cnpj='001.947.183-10', cpf_origem='CPF vindo do ADVBOX', cpf_origem_em=now() where id='2898b1ef-7c92-4a5a-a143-def088f13728' and coalesce(cpf_cnpj,'')='';
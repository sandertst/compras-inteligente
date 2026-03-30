# Compras Inteligente

Versão pronta para GitHub com:
- layout em retrato, melhor para celular
- nome do produto editável
- estoque mínimo editável
- unidade editável
- estoque atual editável
- incluir e excluir produto
- lista automática do que falta comprar
- barra de progresso
- calculadora
- sincronização entre dois celulares via Firebase Realtime Database

## Itens carregados
73 produtos da planilha

## Arquivos
- index.html
- style.css
- data.js
- firebase-config.js
- script.js
- README.md

## Publicar no GitHub
1. Crie um repositório
2. Envie os arquivos para a raiz do repositório
3. Vá em Settings > Pages
4. Em Source, escolha Deploy from a branch
5. Selecione main e /(root)
6. Salve

## Para sincronizar entre dois celulares
1. Crie um projeto no Firebase
2. Ative o Realtime Database
3. Copie as credenciais do app Web
4. Abra o arquivo firebase-config.js
5. Troque enabled para true
6. Preencha projectId, apiKey, authDomain, databaseURL e appId
7. Use o mesmo shoppingListId nos dois celulares

Sem Firebase configurado, o site funciona em modo local.

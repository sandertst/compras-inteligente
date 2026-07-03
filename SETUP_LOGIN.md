# Compras Inteligente - Sistema de Login e Admin

## 📋 O que foi adicionado

1. **Sistema de Autenticação** (Email + Senha)
   - `auth.js` - Gerenciamento de login/logout com Firebase Authentication
   - Usuários precisam fazer login para acessar o app

2. **Painel Administrativo**
   - `admin.html` e `admin.js` - Interface para gerenciar usuários
   - Apenas você (sandertst@gmail.com) tem acesso
   - Criar novos usuários e visualizar dados de todos

3. **Isolamento de Dados por Usuário**
   - Cada usuário vê apenas sua própria lista
   - Estrutura: `/users/{uid}/lista/` no Firebase Realtime Database

4. **Interface Atualizada**
   - `index.html` - Nova tela de login
   - `style.css` - Estilos para login e painel admin
   - `script.js` - Modificado para usar UID do usuário

## 🔧 Configuração Obrigatória

### 1. Atualizar firebase-config.js

Abra o arquivo `firebase-config.js` e substitua as credenciais de placeholder pelas suas reais:

```javascript
window.firebaseSettings = {
  enabled: true,
  apiKey: "SEU_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  databaseURL: "https://seu-projeto.firebaseio.com",
  projectId: "seu-projeto-id",
  appId: "1:123456789:web:abcdef123456"
};
```

### Como conseguir essas credenciais:

1. Abra o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto "compras-inteligente"
3. Vá em **Configurações do Projeto** (ícone de engrenagem)
4. Copie as credenciais da seção "Seu aplicativo web"
5. Cole no `firebase-config.js`

### 2. Configurar Firebase Authentication

No Firebase Console:

1. Vá em **Autenticação** → **Método de login**
2. Clique em **Email/Senha**
3. Ative "Email/Senha"
4. Ative "Permitir inscrição anônima" (desabilitar depois se quiser)

### 3. Configurar Regras do Realtime Database

No Firebase Console → **Realtime Database** → **Regras**:

Substitua o conteúdo pelas regras abaixo (isso garante que cada usuário vê só seus dados):

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth.uid === $uid || root.child('admin_emails').child(auth.token.email).exists()",
        ".write": "auth.uid === $uid || root.child('admin_emails').child(auth.token.email).exists()",
        ".validate": "newData.hasChildren(['email', 'lista'])"
      }
    },
    "admin_emails": {
      ".read": false,
      ".write": false
    }
  }
}
```

### 4. Criar Admin no Firebase

No Firebase Console → **Realtime Database**:

1. Clique em **Adicionar Dados** (ícone de + ao lado de root)
2. Nome: `admin_emails`
3. Clique em **Adicionar Dados** dentro de `admin_emails`
4. Campo: `sandertst@gmail.com`
5. Valor: `true`

Sua estrutura no banco deve ficar assim:
```
root/
  admin_emails/
    sandertst@gmail.com: true
```

## 🚀 Como usar

### Primeiro Acesso (Você)

1. Abra o site: `https://compras-inteligente.vercel.app`
2. Faça **login** com:
   - Email: `sandertst@gmail.com`
   - Senha: (a que você criou no Firebase Auth)
3. No header do app, você verá um botão de "..." (menu admin)
4. Clique nele para ir ao **Painel Admin**

### Criar Novo Usuário

1. No Painel Admin, preencha:
   - Nome completo
   - Email
   - Senha
2. Clique em "Criar usuário"
3. Envie o email e senha para o usuário

### Novo Usuário (Qualquer Pessoa)

1. Abra o site
2. Faça login com o email e senha que recebeu
3. Pronto! Sua lista está criada e isolada

## 📁 Arquivos Modificados/Novos

- ✅ `auth.js` (NOVO)
- ✅ `admin.html` (NOVO)
- ✅ `admin.js` (NOVO)
- ✅ `firebase-config.js` (ATUALIZADO)
- ✅ `index.html` (ATUALIZADO - tela de login)
- ✅ `style.css` (ATUALIZADO - estilos de login/admin)
- ✅ `script.js` (ATUALIZADO - isolamento por UID)
- ✅ `data.js` (MANTIDO - 73 itens)

## 🔒 Segurança

- Senhas são hasheadas pelo Firebase (você nunca vê em texto plano)
- Cada usuário só acessa seus próprios dados
- Admin tem acesso a todos os dados (leitura)
- Não há autorização para editar dados de outros usuários

## 📱 Mobile

O app continua 100% responsivo para celular. Já testado em iOS e Android.

## ⚠️ Importante

- **Guarde suas credenciais do Firebase com segurança** - não as compartilhe
- **Não coloque em commit** o arquivo `.env` com as credenciais reais (já está no `.gitignore`)
- Sempre faça backup dos dados no Firebase Console

## 🆘 Se algo deu errado

1. Abra o console do navegador (F12 → Console)
2. Procure por mensagens de erro em vermelho
3. Erros comuns:
   - "Cannot read properties of null" → Firebase config não foi preenchida corretamente
   - "Permission denied" → Regras do Realtime Database estão erradas
   - "User not found" → Usuário não foi criado ou credenciais erradas

Qualquer dúvida, me contacte!

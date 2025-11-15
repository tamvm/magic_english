# Migration Guide: Electron to Web App

This guide helps you migrate from the original Electron-based Magic English application to the new web application.

## 🔄 Overview

The web application provides the same core functionality as the Electron app but with several advantages:

### ✅ What's Included
- ✅ AI-powered word analysis
- ✅ Sentence scoring and feedback
- ✅ Vocabulary management and search
- ✅ User authentication and profiles
- ✅ Progress tracking and statistics
- ✅ Modern, responsive UI
- ✅ Cloud synchronization
- ✅ Multi-device access

### 🚧 What's Different
- 🔄 **Database**: SQLite files → Supabase (PostgreSQL)
- 🔄 **Authentication**: Local → Cloud-based with Supabase Auth
- 🔄 **Storage**: Local files → Cloud storage
- 🔄 **AI Integration**: Same providers, improved API
- 🔄 **UI Framework**: Vanilla HTML/CSS → React + Tailwind CSS

## 📊 Data Migration

### Exporting from Electron App

1. **Export Vocabulary**
   - Open the Electron app
   - Go to vocabulary management
   - Use the "Export" button to save your words as JSON

2. **Note Your Settings**
   - AI provider configuration
   - Learning goals and preferences
   - Any custom collections/databases

### Importing to Web App

1. **Create Account**
   - Sign up in the web app with your email
   - Verify your email address

2. **Import Vocabulary** (Manual Process)
   The web app doesn't have automatic import yet, but you can:
   - Use the AI analysis feature to quickly re-add important words
   - The AI will provide enhanced analysis compared to the Electron version

3. **Configure Settings**
   - Set up your AI provider (same API keys work)
   - Configure learning goals
   - Set preferences

## 🔧 Technical Migration

### For Developers

If you're migrating the codebase or want to understand the technical differences:

#### Architecture Changes

| Component | Electron App | Web App |
|-----------|--------------|---------|
| Frontend | HTML/CSS/JS | React + Tailwind CSS |
| Backend | IPC + Node.js | Express.js REST API |
| Database | SQLite | Supabase (PostgreSQL) |
| Authentication | None | Supabase Auth |
| Storage | Local files | Cloud database |
| Deployment | Desktop app | Web + API server |

#### Code Structure Mapping

```
Electron App                    Web App
├── electron/                  ├── backend/
│   ├── main.js                │   ├── src/server.js
│   ├── ipcHandlers.js         │   ├── routes/
│   └── services/              │   └── services/
├── src/renderer/              ├── frontend/
│   ├── index.html             │   ├── src/
│   ├── app.js                 │   ├── components/
│   └── styles.css             │   └── pages/
└── data/                      └── (migrated to Supabase)
```

#### Key Differences

1. **IPC Communication → REST API**
   ```javascript
   // Electron (IPC)
   const words = await ipcRenderer.invoke('words:get-all')

   // Web App (REST API)
   const response = await wordsAPI.getWords()
   const words = response.data.words
   ```

2. **Local Storage → Cloud Database**
   ```javascript
   // Electron (Local SQLite)
   const words = await wordStore.getAllWords()

   // Web App (Supabase)
   const { data: words } = await supabase
     .from('words')
     .select('*')
     .eq('user_id', userId)
   ```

3. **No Auth → Supabase Auth**
   ```javascript
   // Electron (No auth)
   // All data is local

   // Web App (Authentication required)
   const { user } = await supabase.auth.getUser()
   // All operations are user-scoped
   ```

## 🔄 Feature Comparison

### Core Features

| Feature | Electron App | Web App | Status |
|---------|--------------|---------|---------|
| Word Analysis | ✅ | ✅ | Improved AI integration |
| Sentence Scoring | ✅ | ✅ | Enhanced UI and feedback |
| Vocabulary Search | ✅ | ✅ | Better search and filtering |
| Progress Tracking | ✅ | ✅ | Cloud-based, more detailed |
| Themes | ✅ | ✅ | System/light/dark modes |
| Multiple Databases | ✅ | 🚧 | Collections (planned) |
| Offline Mode | ✅ | ❌ | Requires internet |
| File Import/Export | ✅ | 🚧 | Export available |

### New Features in Web App

- 🆕 **Multi-device sync**: Access from anywhere
- 🆕 **Real-time updates**: Changes sync instantly
- 🆕 **Better mobile support**: Responsive design
- 🆕 **Cloud backup**: Never lose your data
- 🆕 **Enhanced security**: Proper user authentication
- 🆕 **Better performance**: Modern React architecture

## 🚀 Getting Started

1. **Set up the web app** following the main README
2. **Export your data** from the Electron app
3. **Create an account** in the web app
4. **Re-add important vocabulary** using AI analysis
5. **Configure your settings** (AI provider, goals)

## ❓ FAQ

### Q: Can I run both versions simultaneously?
A: Yes! They use different data storage, so you can run both while transitioning.

### Q: Will my Electron app data be automatically migrated?
A: Not automatically. You'll need to manually export/import vocabulary. We plan to add automatic import in a future update.

### Q: Can I go back to the Electron app?
A: Yes, the Electron app continues to work independently. You can always return to it.

### Q: What about my learning streaks and statistics?
A: These will need to be rebuilt in the web app as you use it. The web app provides more detailed analytics.

### Q: Is the web app as fast as the Electron app?
A: For most operations, yes. Some AI operations may be slightly slower due to network latency, but the overall experience is more responsive.

### Q: Can I use the same AI provider settings?
A: Yes! Your API keys and provider configurations work the same way.

## 🆘 Need Help?

If you encounter issues during migration:

1. **Check the troubleshooting section** in the main README
2. **Open an issue** on the GitHub repository
3. **Compare your Electron app settings** with the web app configuration
4. **Verify your API keys** are correctly configured in both apps

## 🔮 Future Updates

Planned improvements to make migration easier:

- [ ] Automatic data import from Electron app exports
- [ ] Migration wizard in the web app
- [ ] Better vocabulary collection management
- [ ] Offline mode support
- [ ] Desktop app wrapper (Electron) for the web app
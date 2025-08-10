
# 🌟 PSTS Hub - Advanced Communication Platform

![PSTS Hub Banner](https://img.shields.io/badge/PSTS-Hub-blue?style=for-the-badge&logo=chat&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![Status](https://img.shields.io/badge/status-live-brightgreen?style=for-the-badge)

**🔗 Live Demo:** [https://atharva-9423.github.io/PSTS-Hub/](https://atharva-9423.github.io/PSTS-Hub/)

---

## 🏢 About Pmea Solar Tech Solutions Ltd.

PSTS Hub is a cutting-edge communication platform developed for **Pmea Solar Tech Solutions Ltd.**, designed to streamline internal communications, enhance collaboration, and provide secure messaging capabilities for teams across the organization.

---

## ✨ Key Features

### 🔐 **Secure Authentication System**
- Role-based access control (Admin, Moderator, Partner)
- Session management with auto-logout
- Secure credential validation
- Multi-level permission system

### 💬 **Real-Time Messaging**
- Instant messaging with live updates
- Message timestamps and read receipts
- Typing indicators
- Message history preservation

### 📁 **Advanced File Sharing**
- Support for images, videos, audio, and documents
- Database-stored file system for security
- File preview and download capabilities
- Multiple file uploads
- Automatic file type detection

### 📢 **Broadcast System**
- Admin and moderator broadcast capabilities
- Urgent notification system with visual alerts
- Offline message delivery
- Acknowledgment tracking

### 🎨 **Modern User Interface**
- Responsive design for all devices
- Dark/Light theme toggle
- Smooth animations and transitions
- iOS-style design language
- Interactive 3D background using Spline

### 🤖 **AI Assistant Integration**
- Built-in Nexbot AI assistant
- Natural language processing
- Voice synthesis for responses
- Context-aware help system

### 📊 **Data Management**
- Export chat conversations
- Download user data
- Admin data management tools
- Firebase real-time database integration

---

## 🛠️ Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Frontend** | HTML5, CSS3, JavaScript ES6+ | Latest |
| **Backend** | Firebase Realtime Database | v10.7.1 |
| **AI Integration** | Groq SDK | Latest |
| **3D Graphics** | Spline Viewer | v1.10.40 |
| **Build Tool** | Vite | v5.4.8 |
| **Deployment** | GitHub Pages | - |

---

## 🚀 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for real-time features

### 🎯 Getting Started
1. Visit the [live application](https://atharva-9423.github.io/PSTS-Hub/)
2. Select your access level from the login screen
3. Enter credentials and start communicating!

---

## 📱 User Roles & Permissions

### 👑 **Administrator**
- **Full Access**: Complete system administration
- **Capabilities**: 
  - Broadcast messages to all users
  - Delete system data
  - Access all conversations
  - Manage user permissions
  - Download system reports

### 🛡️ **Moderator**
- **Content Management**: Moderation and user oversight
- **Capabilities**:
  - Send broadcast messages
  - View all conversations
  - Moderate content
  - Access partner chats

### 🤝 **Partner**
- **Business Communication**: Limited access for external partners
- **Capabilities**:
  - Message administrators only
  - Share files and documents
  - Receive broadcasts

### 👤 **Member**
- **Basic Access**: Standard user permissions
- **Capabilities**:
  - Message administrators
  - Receive broadcasts
  - Basic file sharing

---

## 💡 How to Use

### 📝 **Sending Messages**
1. Select a contact from the sidebar
2. Type your message in the input field
3. Press Enter or click Send
4. Add attachments using the paperclip icon

### 📎 **File Sharing**
1. Click the attachment button (📎)
2. Select files (max 5MB each, 10 files total)
3. Preview your attachments
4. Send with or without a message

### 📢 **Broadcasting (Admin/Moderator)**
1. Click the "Broadcast Message" button
2. Type your announcement
3. Send to all users instantly
4. Urgent messages trigger special notifications

### 🎨 **Customization**
- Toggle between light/dark themes using the theme button
- Minimize or close the AI assistant
- Download conversation history
- Adjust notification preferences

---

## 🔧 Technical Features

### 🔄 **Real-Time Synchronization**
- Firebase Realtime Database integration
- Instant message delivery
- Live presence indicators
- Automatic reconnection handling

### 🛡️ **Security & Privacy**
- Secure authentication system
- Role-based access control
- Session management
- Data encryption in transit

### 📱 **Responsive Design**
- Mobile-first approach
- Tablet and desktop optimization
- Touch-friendly interface
- Progressive Web App capabilities

### 🎭 **Advanced UI/UX**
- Hardware-accelerated animations
- 120fps smooth scrolling
- Glass morphism effects
- Interactive micro-animations

---

## 🔧 Development Setup

### Local Development
```bash
# Clone the repository
git clone https://github.com/atharva-9423/PSTS-Hub.git

# Navigate to project directory
cd PSTS-Hub

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Environment Variables
Create a `.env` file with:
```env
VITE_GROQ_API_KEY=your_groq_api_key_here
```

---

## 📊 Project Structure

```
PSTS-Hub/
├── 📁 .github/workflows/     # GitHub Actions for deployment
├── 📁 attached_assets/       # Fonts and media files
├── 📄 index.html            # Main HTML file
├── 📄 script.js             # Core JavaScript functionality
├── 📄 style.css             # Styling and animations
├── 📄 vite.config.js        # Build configuration
├── 📄 package.json          # Dependencies and scripts
└── 📄 README.md             # Project documentation
```

---

## 🚀 Deployment

The application is automatically deployed to GitHub Pages using GitHub Actions. Every push to the main branch triggers:

1. **Build Process**: Vite builds the optimized application
2. **Deployment**: Files are deployed to GitHub Pages
3. **Live Update**: Changes appear at the live URL

---

## 🤝 Contributing

We welcome contributions to improve PSTS Hub! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add some AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

---

## 🐛 Troubleshooting

### Common Issues

**Q: Messages not sending?**
A: Check your internet connection and refresh the page.

**Q: Files not uploading?**
A: Ensure files are under 5MB and supported formats.

**Q: Can't log in?**
A: Verify credentials match the role requirements.

**Q: AI assistant not responding?**
A: Check if Groq API key is properly configured.

---

## 📞 Support

For technical support or questions about PSTS Hub:

- **Company**: Pmea Solar Tech Solutions Ltd.
- **Developer**: Atharva Phatangare
- **GitHub**: [atharva-9423](https://github.com/atharva-9423)
- **Issues**: [Report bugs here](https://github.com/atharva-9423/PSTS-Hub/issues)

---

## 📄 License

This project is proprietary software developed for Pmea Solar Tech Solutions Ltd. All rights reserved.

---

## 🎉 Acknowledgments

- **Firebase** for real-time database services
- **Groq** for AI integration capabilities
- **Spline** for 3D interactive backgrounds
- **Vite** for fast build tooling
- **GitHub Pages** for reliable hosting

---

<div align="center">

**🌟 Built with ❤️ for Pmea Solar Tech Solutions Ltd. 🌟**

*Empowering communication, enhancing collaboration*

[![Live Demo](https://img.shields.io/badge/🚀-Live%20Demo-blue?style=for-the-badge)](https://atharva-9423.github.io/PSTS-Hub/)

</div>


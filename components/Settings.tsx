
// ... (Existing Imports)
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { auth } from '../firebase';
import { AppUser, SystemSettings, PermissionLevel, BrandInfo, MessageTemplate } from '../types';
import { getUsers, addUser, updateUser, deleteUser, getSystemSettings, saveSystemSettings, syncCurrentUserToFirestore, resetDatabase, verifyDataIntegrity, getBrandInfo, saveBrandInfo, db, functions, getMessageTemplates, saveMessageTemplate, testGA4Connection } from '../services/db';
import { linkMicrosoftAccount, exchangeMsCode, disconnectMicrosoftAccount } from '../services/microsoft';
// Fix: Use namespace import to bypass missing named exports error
import * as ReactRouterDOM from 'react-router-dom';
const { useNavigate, useLocation } = ReactRouterDOM as any;

// ... (Existing PermissionToggle Component)
interface PermissionToggleProps {
    label: string;
    module: keyof AppUser['permissions'];
    currentLevel: PermissionLevel;
    onChange: (module: keyof AppUser['permissions'], level: PermissionLevel) => void;
}

const PermissionToggle: React.FC<PermissionToggleProps> = ({ label, module, currentLevel, onChange }) => {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-black/20 rounded-lg border border-slate-200 dark:border-slate-700/50 gap-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-32">{label}</span>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
                <button
                    type="button"
                    onClick={() => onChange(module, 'none')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${currentLevel === 'none' ? 'bg-white dark:bg-slate-600 text-slate-500 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Icon name="block" className="text-[14px]" />
                    Sin Acceso
                </button>
                <button
                    type="button"
                    onClick={() => onChange(module, 'view')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${currentLevel === 'view' ? 'bg-blue-500 text-white shadow-sm' : 'text-slate-400 hover:text-blue-500'}`}
                >
                    <Icon name="visibility" className="text-[14px]" />
                    Ver
                </button>
                <button
                    type="button"
                    onClick={() => onChange(module, 'edit')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${currentLevel === 'edit' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-emerald-500'}`}
                >
                    <Icon name="edit" className="text-[14px]" />
                    Editar
                </button>
            </div>
        </div>
    );
};

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // State for Settings
  const [settings, setSettings] = useState<SystemSettings>({
      emailAlerts: true,
      systemNotifications: true,
      paymentAlerts: false,
      language: 'Español (Latinoamérica)',
      timezone: '(GMT-06:00) El Salvador',
      dateFormat: 'DD/MM/AAAA',
      logoUrl: '',
      microsoftTenantId: '',
      microsoftClientId: ''
  });
  
  const [testingGA4, setTestingGA4] = useState(false);
  
  // State for Brand Info
  const [brandInfo, setBrandInfo] = useState<BrandInfo | null>(null);

  // State for Templates
  const [welcomeTemplate, setWelcomeTemplate] = useState<string>('');

  // State for Users
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [connecting, setConnecting] = useState(false); // MS Connection state
  const [activeTab, setActiveTab] = useState<'general' | 'brand' | 'users' | 'integrations' | 'templates'>('general');
  const [integrationError, setIntegrationError] = useState<{title: string, msg: string} | null>(null);
  const [msAccountName, setMsAccountName] = useState<string | null>(null); // To show "DemoUser" or Real Name

  // Password Update State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Add/Edit User UI State
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // File Input Ref for Logo
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref to prevent double auth calls in React StrictMode
  const authProcessed = useRef(false);

  // FIXED ORDER for Permissions
  const PERMISSION_ORDER: { key: keyof AppUser['permissions'], label: string }[] = [
      { key: 'calendar', label: 'Calendario' },
      { key: 'students', label: 'Estudiantes' },
      { key: 'teachers', label: 'Profesores' },
      { key: 'courses', label: 'Cursos' },
      { key: 'exams', label: 'Exámenes' },
      { key: 'finance', label: 'Finanzas' },
      { key: 'settings', label: 'Configuración' },
  ];

  const initialPermissions: AppUser['permissions'] = { 
      students: 'none', 
      courses: 'none', 
      exams: 'none',
      finance: 'none', 
      settings: 'none',
      calendar: 'none',
      teachers: 'none'
  };
  
  const [newUser, setNewUser] = useState({ 
      name: '', 
      email: '', 
      role: 'Secretaría', 
      password: '',
      permissions: { ...initialPermissions }
  });

  // --- MS AUTH CALLBACK HANDLER ---
  useEffect(() => {
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');
      const isDemo = code === 'MOCK_AUTH_CODE_FOR_DEMO';

      if (code && !authProcessed.current) {
          authProcessed.current = true;
          setConnecting(true);
          
          if (isDemo) {
               saveSystemSettings({...settings, microsoftTenantId: 'demo-tenant'}).then(() => {
                   setSettings(s => ({...s, microsoftTenantId: 'demo-tenant'}));
                   setMsAccountName("DemoUser@georgetown.edu.sv");
                   setConnecting(false);
                   navigate('/portal/settings', { replace: true });
               });
               return;
          }

          exchangeMsCode(code)
              .then(() => getSystemSettings())
              .then((newSettings) => {
                  if (newSettings && newSettings.microsoftTenantId) {
                      setSettings(newSettings);
                      alert("✅ Cuenta de Microsoft vinculada con éxito.");
                  }
              })
              .catch(err => {
                  console.error("Exchange Error:", err);
                  setIntegrationError({ title: "Error de vinculación", msg: err.message || "Error desconocido" });
              })
              .finally(() => {
                  setConnecting(false);
                  navigate('/portal/settings', { replace: true });
              });
      }
  }, [location.search, navigate]);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const authUser = auth.currentUser;
        if (authUser) {
            const profile = await syncCurrentUserToFirestore(authUser);
            setCurrentUserProfile(profile);
        }

        const [fetchedUsers, fetchedSettings, fetchedBrand, templates] = await Promise.all([
            getUsers(),
            getSystemSettings(),
            getBrandInfo(),
            getMessageTemplates()
        ]);
        
        if (fetchedUsers) setUsers(fetchedUsers);
        if (fetchedSettings) setSettings(fetchedSettings);
        if (fetchedBrand) setBrandInfo(fetchedBrand);

        // Load Welcome Template
        const welcome = templates.find(t => t.id === 'welcome_default');
        if (welcome) {
            setWelcomeTemplate(welcome.content);
        } else {
            setWelcomeTemplate(`¡Bienvenido/a {{studentName}}! 🎓\n\nTu inscripción al curso *{{course}}* está confirmada.\n\n🎟️ *Adjunto encontrarás tu Ticket de Acceso.*\n\n*Credenciales del Portal:*\n👤 ID: {{email}}\n🔒 Clave: {{password}}\n\n👉 Accede aquí: {{portalLink}}`);
        }

        // Fetch MS Auth Status Detail
        try {
            const secretDoc = await db.collection('system_secrets').doc('microsoft_auth').get();
            if (secretDoc.exists) {
                const data = secretDoc.data();
                setMsAccountName(data?.userName || 'Desconocido');
                setSettings(prev => ({ ...prev, microsoftTenantId: 'connected' }));
            } else {
                setMsAccountName(null);
                setSettings(prev => ({ ...prev, microsoftTenantId: '' }));
            }
        } catch (e) { console.error("Error fetching secrets status", e); }
        
        setLoading(false);
    };
    fetchData();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      // ... (Existing Logic) ...
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          setSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
      setSettings(prev => ({ ...prev, logoUrl: '' }));
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTestGA4 = async () => {
      setTestingGA4(true);
      const res = await testGA4Connection();
      if (res.success) {
          alert(`✅ Conexión exitosa a Google Analytics.\n\nDatos recientes:\nVisitas: ${res.visitors}\nVistas de página: ${res.pageViews}`);
      } else {
          alert(`❌ Error al conectar con GA4:\n${res.error}`);
      }
      setTestingGA4(false);
  };

  const handleSaveSettings = async () => {
      setSaving(true);
      try {
          await saveSystemSettings(settings);
          if (brandInfo) await saveBrandInfo(brandInfo);
          
          // Save Welcome Template
          await saveMessageTemplate({
              id: 'welcome_default',
              type: 'welcome',
              name: 'Bienvenida Estudiante',
              content: welcomeTemplate,
              isDefault: true
          });

          const event = new CustomEvent('logo-updated', { detail: settings.logoUrl });
          window.dispatchEvent(event);
          alert('Configuración guardada exitosamente.');
      } catch (e) {
          alert('Error al guardar configuración.');
      } finally {
          setSaving(false);
      }
  };

  // ... (Other handlers unchanged: handleResetDatabase, handleIntegrityCheck, etc.) ...
  const handleResetDatabase = async () => {
      if (!confirm("⚠️ ¡PELIGRO CRÍTICO!\n\nEsta acción eliminará PERMANENTEMENTE:\n- Todos los estudiantes\n- Cursos y clases\n- Exámenes\n- Asistencias\n\n¿Escribe 'BORRAR' para confirmar?")) return;
      if(!confirm("¿Está absolutamente seguro?")) return;

      setResetting(true);
      try {
          await resetDatabase();
          alert("Base de datos reiniciada.");
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert("Error al reiniciar la base de datos.");
      } finally {
          setResetting(false);
      }
  };

  const handleIntegrityCheck = async () => {
      setResetting(true);
      try {
          const removed = await verifyDataIntegrity();
          if (removed > 0) alert(`Limpieza completada. Se eliminaron ${removed} registros.`);
          else alert("La base de datos está limpia.");
      } catch(e) {
          alert("Error en verificación.");
      } finally {
          setResetting(false);
      }
  }

  const handleUpdatePassword = async () => {
      if (newPassword !== confirmPassword) {
          alert("Las contraseñas no coinciden.");
          return;
      }
      try {
          const user = auth.currentUser;
          if (user) {
              await user.updatePassword(newPassword);
              alert("Contraseña actualizada correctamente.");
              setNewPassword('');
              setConfirmPassword('');
          }
      } catch (e: any) {
          alert("Error: " + e.message);
      }
  };

  const handlePermissionChange = (module: keyof AppUser['permissions'], level: PermissionLevel) => {
      setNewUser(prev => ({
          ...prev,
          permissions: {
              ...prev.permissions,
              [module]: level
          }
      }));
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
      // ... (Existing Logic) ...
      e.preventDefault();
      try {
          const roleColors: any = {
              'Administrador': 'bg-primary/20 text-primary',
              'Secretaría': 'bg-indigo-500/20 text-indigo-500',
              'Contabilidad': 'bg-orange-500/20 text-orange-500'
          };
          const initials = newUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
          const userPayload: Omit<AppUser, 'id'> & { tempPassword?: string } = {
              name: newUser.name,
              email: newUser.email,
              role: newUser.role as any,
              initials: initials,
              colorClass: roleColors[newUser.role] || 'bg-slate-500/20 text-slate-500',
              permissions: newUser.permissions,
              isSuperAdmin: false,
              ...(newUser.password ? { tempPassword: newUser.password } : {})
          };
          if (editingId) {
             await updateUser(editingId, userPayload);
             alert(`Usuario actualizado.`);
          } else {
             await addUser(userPayload);
             alert(`Usuario creado.`);
          }
          const updatedUsers = await getUsers();
          setUsers(updatedUsers);
          resetUserForm();
      } catch (e: any) {
          alert("Error: " + e.message);
      }
  };

  const handleEditUser = (user: AppUser) => {
      const safePermissions: any = { ...initialPermissions };
      PERMISSION_ORDER.forEach(({ key }) => {
          const val = (user.permissions as any)?.[key];
          if (val === true) safePermissions[key] = 'edit';
          else if (val === false) safePermissions[key] = 'none';
          else if (val) safePermissions[key] = val;
      });
      setNewUser({
          name: user.name,
          email: user.email,
          role: user.role,
          password: '',
          permissions: safePermissions
      });
      setEditingId(user.id);
      setShowAddUser(true);
  };

  const resetUserForm = () => {
      setShowAddUser(false);
      setEditingId(null);
      setNewUser({ 
          name: '', 
          email: '', 
          role: 'Secretaría', 
          password: '', 
          permissions: { ...initialPermissions } 
      });
  }

  const handleDeleteUser = async (id: string) => {
      if (!confirm("¿Eliminar usuario?")) return;
      await deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));
  };

  const handleConnectMicrosoft = async () => {
      setIntegrationError(null);
      if (!confirm("Será redirigido al inicio de sesión de Microsoft Entra. ¿Continuar?")) return;
      setConnecting(true);
      try {
          await linkMicrosoftAccount();
      } catch (e: any) {
          console.error("Connection Init Error:", e);
          const msg = e.message || "";
          if (msg.includes("SERVER_KEYS_MISSING")) {
              setIntegrationError({ title: "⚠️ Falta Configuración", msg: "El servidor rechazó la solicitud." });
          } else {
              setIntegrationError({ title: "Error", msg: msg });
          }
          setConnecting(false);
      }
  };

  const handleDemoConnect = async () => {
      window.location.href = '/portal/settings?code=MOCK_AUTH_CODE_FOR_DEMO';
  };

  const handleDisconnectMicrosoft = async () => {
      if(!confirm("¿Desconectar cuenta?")) return;
      setConnecting(true);
      try {
          await disconnectMicrosoftAccount();
      } catch(e) { console.warn("Wipe failed"); }
      setSettings({...settings, microsoftTenantId: ''});
      setMsAccountName(null);
      await saveSystemSettings({...settings, microsoftTenantId: ''});
      setIntegrationError(null);
      alert("Cuenta desconectada.");
      setConnecting(false);
  };

  const handleCleanupCalendar = async () => {
      if (!confirm("⚠️ ¿Eliminar eventos 'Clase Online:' del calendario?")) return;
      setConnecting(true);
      try {
          const cleanupFn = functions.httpsCallable('cleanupCalendarEvents');
          const result = await cleanupFn();
          const data = result.data as any;
          if (data.success) alert(`✅ Limpieza completada: ${data.count} eventos.`);
          else alert(`⚠️ Error: ${data.error}`);
      } catch (e: any) {
          alert(`❌ Error: ${e.message}`);
      } finally {
          setConnecting(false);
      }
  };

  const isSuperAdmin = currentUserProfile?.isSuperAdmin;
  const isDemoConnection = msAccountName && msAccountName.includes('DemoUser');

  if (loading) return <div className="flex-1 flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-500"><Icon name="sync" className="animate-spin text-3xl" /></div>;

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark scroll-smooth">
      <div className="flex-1 overflow-y-auto px-4 sm:px-10 py-10">
        <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-[#283933] pb-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">Configuración</h1>
                    <p className="text-slate-600 dark:text-text-secondary text-base">Administración de sistema y usuarios.</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 overflow-x-auto">
                        <button onClick={() => setActiveTab('general')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'general' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>General</button>
                        <button onClick={() => setActiveTab('brand')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'brand' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Branding</button>
                        <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Usuarios</button>
                        <button onClick={() => setActiveTab('templates')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'templates' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Mensajes</button>
                        <button onClick={() => setActiveTab('integrations')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'integrations' ? 'bg-white dark:bg-slate-600 shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Integraciones</button>
                    </div>
                    <button onClick={handleSaveSettings} disabled={saving} className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-lg disabled:opacity-70 transition-all active:scale-95 whitespace-nowrap">
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                
                {/* TAB: GENERAL */}
                {activeTab === 'general' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Logo Upload */}
                        <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-[#283933] shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Icon name="image" /> Logotipo del Sistema</h2>
                            <div className="flex flex-col gap-4">
                                <div className="relative group w-full h-40 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                                    {settings.logoUrl ? (
                                        <>
                                            <img src={settings.logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-4" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">Click para cambiar</div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-slate-400"><Icon name="cloud_upload" className="text-3xl mb-1" /><span className="text-xs font-medium">Subir Logo (PNG/JPG)</span></div>
                                    )}
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoUpload} />
                                </div>
                                {settings.logoUrl && <button onClick={handleRemoveLogo} className="w-full py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 text-xs font-bold hover:bg-slate-50">Restaurar Logo</button>}
                            </div>
                        </section>

                        {/* Account Settings */}
                        <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-[#283933] shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2"><Icon name="lock" /> Mi Cuenta</h2>
                            <div className="flex flex-col gap-3">
                                <input value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111816] border border-slate-200 dark:border-[#3e554d] rounded-lg px-3 py-2 text-sm dark:text-white" type="password" placeholder="Nueva Contraseña" />
                                <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-[#111816] border border-slate-200 dark:border-[#3e554d] rounded-lg px-3 py-2 text-sm dark:text-white" type="password" placeholder="Confirmar" />
                                <button onClick={handleUpdatePassword} className="w-full bg-slate-800 dark:bg-white text-white dark:text-slate-900 py-2 rounded-lg font-bold text-sm">Actualizar</button>
                            </div>
                        </section>

                        {isSuperAdmin && (
                            <section className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-200 dark:border-red-900/30 lg:col-span-2">
                                <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-4"><Icon name="warning" /> Zona de Peligro</h2>
                                <div className="flex flex-wrap gap-4">
                                    <button onClick={handleResetDatabase} disabled={resetting} className="px-6 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold shadow-sm">Reiniciar BD</button>
                                    <button onClick={handleIntegrityCheck} disabled={resetting} className="px-6 py-2 bg-white border border-orange-200 text-orange-600 rounded-lg text-sm font-bold shadow-sm">Verificar Integridad</button>
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* TAB: BRAND INFO */}
                {activeTab === 'brand' && brandInfo && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-[#283933] shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Información Básica</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                                    <input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={brandInfo.name} onChange={e => setBrandInfo({...brandInfo, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Eslogan</label>
                                    <input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={brandInfo.tagline} onChange={e => setBrandInfo({...brandInfo, tagline: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección</label>
                                    <textarea rows={3} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={brandInfo.address} onChange={e => setBrandInfo({...brandInfo, address: e.target.value})} />
                                </div>
                            </div>
                        </section>

                        <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-[#283933] shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Contacto</h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label><input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={brandInfo.phonePrimary} onChange={e => setBrandInfo({...brandInfo, phonePrimary: e.target.value})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Móvil</label><input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={brandInfo.phoneSecondary} onChange={e => setBrandInfo({...brandInfo, phoneSecondary: e.target.value})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp #</label><input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={brandInfo.whatsappNumber} onChange={e => setBrandInfo({...brandInfo, whatsappNumber: e.target.value})} /></div>
                                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label><input className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:text-white" value={brandInfo.email} onChange={e => setBrandInfo({...brandInfo, email: e.target.value})} /></div>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* TAB: TEMPLATES */}
                {activeTab === 'templates' && (
                    <div className="max-w-4xl mx-auto">
                        <section className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-[#283933] shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                <Icon name="chat" className="text-emerald-500" /> Plantilla de Bienvenida (WhatsApp)
                            </h2>
                            <p className="text-sm text-slate-500 mb-4">
                                Este mensaje se carga automáticamente al aprobar un estudiante. Puedes usar variables como <code>{'{{studentName}}'}</code>, <code>{'{{course}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{password}}'}</code>.
                            </p>
                            <textarea 
                                rows={10} 
                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary outline-none"
                                value={welcomeTemplate}
                                onChange={e => setWelcomeTemplate(e.target.value)}
                            ></textarea>
                            <div className="mt-4 flex justify-end">
                                <p className="text-xs text-slate-400 mr-auto flex items-center gap-1">
                                    <Icon name="info" /> El ticket (imagen) se genera automáticamente.
                                </p>
                            </div>
                        </section>
                    </div>
                )}

                {/* TAB: USERS */}
                {activeTab === 'users' && (
                    <section className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-[#283933] shadow-sm flex flex-col h-full">
                        {/* ... Existing User Tab Content ... */}
                        <div className="p-6 border-b border-slate-200 dark:border-[#283933] flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Icon name="group" /> Usuarios</h2>
                            <button onClick={() => { showAddUser ? resetUserForm() : setShowAddUser(true) }} className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${showAddUser ? 'bg-red-500' : 'bg-primary'}`}>
                                {showAddUser ? "Cancelar" : "Nuevo Usuario"}
                            </button>
                        </div>
                        {/* ... Rest of User Tab (unchanged) ... */}
                        {showAddUser && (
                            <form onSubmit={handleUserFormSubmit} className="p-6 bg-slate-50 dark:bg-[#161e1b] border-b border-slate-200 dark:border-[#283933] animate-in slide-in-from-top-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div><label className="text-xs font-bold text-slate-500">Nombre</label><input required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full rounded-lg px-3 py-2 text-sm border dark:bg-black/20 dark:border-slate-700 dark:text-white" /></div>
                                    <div><label className="text-xs font-bold text-slate-500">Correo</label><input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full rounded-lg px-3 py-2 text-sm border dark:bg-black/20 dark:border-slate-700 dark:text-white" /></div>
                                    <div><label className="text-xs font-bold text-slate-500">Rol</label>
                                        <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="w-full rounded-lg px-3 py-2 text-sm border dark:bg-black/20 dark:border-slate-700 dark:text-white">
                                            <option value="Secretaría">Secretaría</option>
                                            <option value="Contabilidad">Contabilidad</option>
                                            <option value="Administrador">Administrador</option>
                                        </select>
                                    </div>
                                    <div><label className="text-xs font-bold text-slate-500">Contraseña</label><input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full rounded-lg px-3 py-2 text-sm border dark:bg-black/20 dark:border-slate-700 dark:text-white" placeholder={editingId ? "Sin cambios" : ""} /></div>
                                </div>
                                <div className="mb-6">
                                    <label className="text-xs font-bold text-slate-500 mb-3 block uppercase tracking-wide">Permisos Detallados</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {PERMISSION_ORDER.map(p => (
                                            <PermissionToggle 
                                                key={p.key} 
                                                label={p.label} 
                                                module={p.key} 
                                                currentLevel={newUser.permissions[p.key]}
                                                onChange={handlePermissionChange}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-green-600 rounded-lg shadow-lg hover:bg-green-700 transition-colors">
                                        {editingId ? 'Actualizar Usuario' : 'Crear Usuario'}
                                    </button>
                                </div>
                            </form>
                        )}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[700px]">
                                <thead className="bg-slate-50 dark:bg-[#161e1b] text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="py-4 px-6">Usuario</th>
                                        <th className="py-4 px-6">Nivel de Acceso</th>
                                        <th className="py-4 px-6 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-[#283933]">
                                    {users.map(user => (
                                        <tr key={user.id}>
                                            <td className="py-4 px-6"><div className="font-bold text-sm text-slate-900 dark:text-white">{user.name}</div><div className="text-xs text-slate-500">{user.role}</div></td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-wrap gap-1.5 max-w-md">
                                                    {PERMISSION_ORDER.map(({ key, label }) => {
                                                        const val = (user.permissions as any)?.[key];
                                                        let level = val;
                                                        if (val === true) level = 'edit';
                                                        if (val === false || !val) level = 'none';
                                                        if (level === 'none') return null;
                                                        const color = level === 'edit' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400';
                                                        const icon = level === 'edit' ? 'edit' : 'visibility';
                                                        return (
                                                            <span key={key} className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1 ${color}`}>
                                                                <Icon name={icon} className="text-[10px]" /> {key === 'finance' ? 'Fin' : label}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right flex justify-end gap-2">
                                                <button onClick={() => handleEditUser(user)} className="text-slate-400 hover:text-primary transition-colors"><Icon name="edit" /></button>
                                                {!user.isSuperAdmin && <button onClick={() => handleDeleteUser(user.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Icon name="delete" /></button>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* TAB: INTEGRATIONS */}
                {activeTab === 'integrations' && (
                    <section className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-[#283933] shadow-sm p-6 max-w-4xl">
                        {/* Error Banner */}
                        {integrationError && (
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex gap-3 items-start animate-in slide-in-from-top-2">
                                <Icon name="error" className="text-red-500 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="font-bold text-red-700 dark:text-red-400 text-sm">{integrationError.title}</h4>
                                    <p className="text-sm text-red-600 dark:text-red-300 mt-1 leading-relaxed">{integrationError.msg}</p>
                                </div>
                                <button onClick={() => setIntegrationError(null)} className="text-red-400 hover:text-red-600"><Icon name="close" /></button>
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row items-start gap-6">
                            <div className="flex items-center justify-center p-4 bg-[#464EB8]/10 rounded-2xl shrink-0">
                                <span className="material-symbols-outlined text-[#464EB8] text-6xl">video_call</span>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Microsoft Entra ID & Teams</h2>
                                <p className="text-slate-500 dark:text-text-secondary text-sm mb-4 leading-relaxed">
                                    Conecte su cuenta institucional de Microsoft Entra para automatizar la creación de aulas virtuales.
                                </p>
                                
                                {settings.microsoftTenantId ? (
                                    <div className={`border rounded-xl p-4 flex items-center gap-3 mb-4 ${isDemoConnection ? 'bg-amber-100 border-amber-300 dark:bg-amber-900/20 dark:border-amber-700' : 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'}`}>
                                        <Icon name={isDemoConnection ? "science" : "verified"} className={`${isDemoConnection ? 'text-amber-600' : 'text-green-600'} text-3xl`} />
                                        <div className="flex-1">
                                            <p className={`font-black text-lg ${isDemoConnection ? 'text-amber-800 dark:text-amber-200' : 'text-green-800 dark:text-green-200'}`}>
                                                {isDemoConnection ? 'MODO DEMO' : 'CONEXIÓN ACTIVA'}
                                            </p>
                                            <p className={`text-sm opacity-80 ${isDemoConnection ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
                                                {isDemoConnection ? 'Simulación activada.' : `Cuenta: ${msAccountName || 'Usuario'}`}
                                            </p>
                                        </div>
                                        <button onClick={handleDisconnectMicrosoft} className="px-4 py-2 bg-white dark:bg-surface-dark border border-red-200 dark:border-red-900 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors shadow-sm">
                                            Desconectar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button onClick={handleConnectMicrosoft} disabled={connecting} className="bg-[#464EB8] hover:bg-[#3b429c] text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 flex-1">
                                                    {connecting ? <Icon name="sync" className="animate-spin" /> : <Icon name="login" />}
                                                    {connecting ? "Conectando..." : "Conectar cuenta"}
                                                </button>
                                                <button onClick={handleDemoConnect} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow-sm transition-all flex items-center justify-center gap-2" title="Simulación">
                                                    <Icon name="science" className="text-amber-500" /> Modo Demo
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {settings.microsoftTenantId && (
                                    <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                                        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
                                            <div className="p-2 bg-orange-100 dark:bg-orange-800/30 rounded-lg text-orange-600 dark:text-orange-400">
                                                <Icon name="cleaning_services" className="text-2xl" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-orange-800 dark:text-orange-300">Limpiar Eventos Huérfanos</p>
                                            </div>
                                            <button onClick={handleCleanupCalendar} disabled={connecting} className="px-4 py-2 bg-white dark:bg-surface-dark border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-lg hover:bg-orange-50 transition-colors shadow-sm whitespace-nowrap">
                                                {connecting ? 'Limpiando...' : 'Ejecutar Limpieza'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                         {/* GA4 INTEGRATION */}
                         <div className="flex flex-col md:flex-row items-start gap-6 mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                             <div className="flex items-center justify-center p-4 bg-orange-500/10 rounded-2xl shrink-0">
                                 <Icon name="analytics" className="text-orange-500 text-6xl" />
                             </div>
                             <div className="flex-1 w-full">
                                 <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Google Analytics 4 (GA4)</h2>
                                 <p className="text-slate-500 dark:text-text-secondary text-sm mb-4 leading-relaxed">
                                     Configure el acceso a la API de Google Analytics para ver estadísticas avanzadas en su Dashboard.
                                 </p>

                                 <div className="grid grid-cols-1 gap-4 mb-4">
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">ID de Propiedad (Property ID)</label>
                                        <input 
                                            value={settings.ga4PropertyId || ''} 
                                            onChange={e => setSettings({...settings, ga4PropertyId: e.target.value})} 
                                            placeholder="ej. 123456789"
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white" 
                                        />
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">ID de Meta Pixel</label>
                                        <input 
                                            value={settings.metaPixelId || ''} 
                                            onChange={e => setSettings({...settings, metaPixelId: e.target.value})} 
                                            placeholder="ej. 1240913734670032"
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white" 
                                        />
                                        <p className="text-[10px] text-slate-400 mt-2">
                                            Deje esto en blanco si ha insertado el script de Pixel manualmente en index.html. Si ingresa un valor aquí, reemplazará el valor del script y usará este ID.
                                        </p>
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Service Account JSON</label>
                                        <textarea 
                                            value={settings.ga4ServiceAccountJson || ''} 
                                            onChange={e => setSettings({...settings, ga4ServiceAccountJson: e.target.value})} 
                                            placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key_id": "...",\n...}'}
                                            rows={6}
                                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-mono text-slate-900 dark:text-white" 
                                        />
                                        <p className="text-[10px] text-slate-400 mt-2">
                                            Pegue aquí el contenido completo del archivo JSON generado en Google Cloud Console. 
                                        </p>
                                     </div>
                                 </div>
                                 <div className="flex justify-end gap-3">
                                     <button onClick={handleTestGA4} disabled={testingGA4} className="px-6 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-sm rounded-lg transition-all">
                                         {testingGA4 ? 'Probando...' : 'Probar Conexión'}
                                     </button>
                                     <button onClick={handleSaveSettings} disabled={saving} className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-lg shadow-md transition-all">
                                         {saving ? 'Guardando...' : 'Guardar Credenciales'}
                                     </button>
                                 </div>
                             </div>
                         </div>
                    </section>
                )}
            </div>
        </div>
      </div>
    </main>
  );
};

export default Settings;
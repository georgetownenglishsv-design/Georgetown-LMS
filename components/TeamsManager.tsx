
import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { functions } from '../firebase';
import { getSystemLogs } from '../services/db';
import { SystemLog } from '../types';

const TeamsManager: React.FC = () => {
    const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    // Master Sync State
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncResult, setSyncResult] = useState<{
        processedFiles: number;
        updatedSessions: number;
        clearedSessions: number;
        errors?: string[];
    } | null>(null);

    // Load logs on mount
    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoadingLogs(true);
        const logs = await getSystemLogs();
        setSystemLogs(logs);
        setLoadingLogs(false);
    };

    // --- MASTER SYNC HANDLER ---
    const handleMasterSync = async () => {
        if (!confirm("⚠️ 주의: 완전 동기화를 시작하시겠습니까?\n\n이 작업은 OneDrive의 실제 파일 목록을 기준으로 데이터베이스를 강제로 일치시킵니다.\n- OneDrive에 없는 링크는 DB에서 삭제됩니다.\n- OneDrive에 있는 새 파일은 DB에 추가됩니다.")) return;

        setSyncLoading(true);
        setSyncResult(null);
        
        try {
            // Re-using the cleanup function name but it now acts as Master Sync
            const syncFn = functions.httpsCallable('cleanupOrphanedRecordings');
            // mode: 'master_sync' tells backend to do the full overwrite logic
            const result = await syncFn({ mode: 'master_sync' });
            const data = result.data as any;

            if (data.success) {
                setSyncResult({
                    processedFiles: data.stats.totalOneDriveFiles,
                    updatedSessions: data.stats.updatedCount,
                    clearedSessions: data.stats.clearedCount
                });
                alert(`✅ 동기화 완료!\n\n📂 OneDrive 파일 스캔: ${data.stats.totalOneDriveFiles}개\n🔗 링크 연결/갱신: ${data.stats.updatedCount}개 수업\n🧹 죽은 링크 청소: ${data.stats.clearedCount}개 수업`);
                fetchLogs();
            } else {
                alert("❌ 오류 발생: " + data.error);
            }
        } catch (e: any) {
            console.error(e);
            alert("시스템 오류: " + e.message);
        } finally {
            setSyncLoading(false);
        }
    };

    const handleDebugOneDrive = async () => {
        const debugFn = functions.httpsCallable('debugOneDrive');
        try {
            const res = await debugFn();
            console.log(res.data);
            alert("디버그 데이터가 콘솔에 출력되었습니다. (F12 -> Console)");
        } catch(e: any) {
            alert("디버그 실패: " + e.message);
        }
    };

    const formatTimestamp = (ts: any) => {
        if (!ts) return '-';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleString('es-ES', { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });
    };

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
            <header className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800 px-6 py-6 shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Icon name="hub" className="text-3xl" />
                        </div>
                        Sincronización Inteligente
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-text-secondary mt-1 ml-14">
                        OneDrive를 마스터 데이터로 사용하여 플랫폼을 동기화합니다.
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 md:p-10">
                <div className="max-w-5xl mx-auto space-y-10">
                    
                    {/* MASTER SYNC CARD */}
                    <section className="bg-white dark:bg-surface-dark rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                        <div className="p-8">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                <div className="flex-1">
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                                        <Icon name="cloud_sync" className="text-primary" /> 
                                        Master Sync (OneDrive ➔ DB)
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-2xl">
                                        이 기능은 <b>OneDrive의 실제 파일 목록</b>을 가져와서 데이터베이스를 덮어씁니다.<br/>
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">• 존재하는 파일:</span> 자동으로 링크가 연결됩니다.<br/>
                                        <span className="text-red-500 font-bold">• 삭제된 파일:</span> DB에서도 즉시 제거됩니다 (Garbage Collection).
                                    </p>
                                </div>
                                <button 
                                    onClick={handleMasterSync}
                                    disabled={syncLoading}
                                    className="px-8 py-4 bg-slate-900 hover:bg-primary dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-white rounded-2xl font-bold shadow-lg transition-all flex items-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed active:scale-95 shrink-0"
                                >
                                    {syncLoading ? (
                                        <>
                                            <Icon name="sync" className="animate-spin text-xl" />
                                            <span>Sincronizando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="play_circle" className="text-xl" />
                                            <span>Ejecutar Sincronización Total</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Result Display */}
                            {syncResult && (
                                <div className="mt-8 bg-slate-50 dark:bg-black/20 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                                    <h3 className="text-sm font-bold text-slate-700 dark:text-white uppercase tracking-wider mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">Resultados del Proceso</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                                            <div className="size-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                                                <Icon name="folder" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">{syncResult.processedFiles}</p>
                                                <p className="text-xs text-slate-500 font-bold uppercase">Archivos en OneDrive</p>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                                            <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
                                                <Icon name="link" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">{syncResult.updatedSessions}</p>
                                                <p className="text-xs text-slate-500 font-bold uppercase">Clases Actualizadas</p>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
                                            <div className="size-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                                                <Icon name="cleaning_services" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">{syncResult.clearedSessions}</p>
                                                <p className="text-xs text-slate-500 font-bold uppercase">Links Muertos Eliminados</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* HISTORY LOGS */}
                    <section className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-black/20">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                                <Icon name="history" /> Historial de Ejecución
                            </h3>
                            <div className="flex gap-2">
                                <button onClick={handleDebugOneDrive} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 border border-slate-200 rounded-lg">
                                    Debug Raw
                                </button>
                                <button onClick={fetchLogs} className="text-xs font-bold text-primary hover:underline flex items-center gap-1 px-3 py-1.5">
                                    <Icon name="refresh" className={loadingLogs ? "animate-spin" : ""} /> Actualizar
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-white/5 text-xs uppercase text-slate-500 font-bold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-3">Fecha</th>
                                        <th className="px-6 py-3">Estado</th>
                                        <th className="px-6 py-3">Resumen</th>
                                        <th className="px-6 py-3">Tipo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {loadingLogs ? (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Cargando logs...</td></tr>
                                    ) : systemLogs.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No hay registros recientes.</td></tr>
                                    ) : (
                                        systemLogs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-3 font-mono text-slate-600 dark:text-slate-300">{formatTimestamp(log.timestamp)}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        log.status === 'SUCCESS' 
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}>
                                                        <span className={`size-1.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-slate-700 dark:text-slate-300 text-xs">{log.summary}</td>
                                                <td className="px-6 py-3">
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{log.trigger}</span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
};

export default TeamsManager;

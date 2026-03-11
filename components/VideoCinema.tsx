
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { functions } from '../firebase';

interface VideoCinemaProps {
    url: string;
    title: string;
    onClose: () => void;
}

const VideoCinema: React.FC<VideoCinemaProps> = ({ url, title, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [buffering, setBuffering] = useState(false); // New state for mid-playback buffering
    const [error, setError] = useState<string | null>(null);
    const [ticketExpiry, setTicketExpiry] = useState<number>(0);

    const fetchFreshTicket = async () => {
        try {
            const getStreamTicket = functions.httpsCallable('getStreamTicket');
            const result = await getStreamTicket({ url });
            const data = result.data as { downloadUrl: string };
            
            if (data.downloadUrl) {
                setStreamUrl(data.downloadUrl);
                // 티켓 유효기간을 현재시간 + 50분으로 설정 (안전빵)
                setTicketExpiry(Date.now() + (50 * 60 * 1000));
                return data.downloadUrl;
            }
            throw new Error("No download URL returned from server.");
        } catch (e: any) {
            console.error("[Cinema] Ticket fetch failed:", e);
            // 에러 메시지를 사용자에게 더 친절하게 보여줍니다.
            setError(e.message || "No se pudo obtener el acceso al video.");
            return null;
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError(null);
            await fetchFreshTicket();
            setLoading(false);
        };
        init();
    }, [url]);

    // 실시간 티켓 감시 및 갱신 로직 (Background JIT Refresh)
    useEffect(() => {
        const interval = setInterval(async () => {
            if (streamUrl && ticketExpiry > 0 && Date.now() > ticketExpiry) {
                console.log("[Cinema] Ticket expiring, refreshing in background...");
                await fetchFreshTicket();
            }
        }, 60000); // 1분마다 체크
        return () => clearInterval(interval);
    }, [streamUrl, ticketExpiry]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleFallbackOpen = () => {
        // SharePoint 원본 링크는 별도 탭에서 열어줍니다.
        window.open(url, '_blank');
    };

    // 버퍼링 이벤트 핸들러
    const handleWaiting = () => setBuffering(true);
    const handlePlaying = () => {
        setBuffering(false);
        setLoading(false);
    };
    const handleCanPlay = () => setLoading(false);

    return (
        <div 
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-500"
            onClick={handleBackdropClick}
        >
            {/* Header Control */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex flex-col">
                    <p className="text-gold font-bold text-[10px] uppercase tracking-[0.3em] mb-1">Georgetown Academy :: Cinema</p>
                    <h3 className="text-white text-xl font-black truncate max-w-md">{title}</h3>
                </div>
                <button 
                    onClick={onClose}
                    className="size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all hover:rotate-90 active:scale-90"
                >
                    <Icon name="close" className="text-2xl" />
                </button>
            </div>

            <div className="w-full max-w-6xl aspect-video relative group px-4">
                {/* Initial Loading or Error */}
                {loading && !error && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/50 backdrop-blur-sm rounded-2xl">
                        <div className="size-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                        <p className="text-slate-400 font-bold text-sm animate-pulse">Cargando transmisión...</p>
                    </div>
                )}

                {/* Mid-playback Buffering Indicator */}
                {!loading && buffering && !error && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <div className="size-12 rounded-full border-4 border-white/20 border-t-white animate-spin"></div>
                    </div>
                )}

                {error ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-black/80 rounded-2xl">
                        <div className="size-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                            <Icon name="error" className="text-5xl text-red-500" />
                        </div>
                        <h4 className="text-white text-xl font-bold mb-2">Error de Conectividad Directa</h4>
                        <p className="text-slate-400 max-w-sm mb-8 text-sm leading-relaxed">
                            No pudimos establecer un túnel de transmisión directa. Esto puede ocurrir si el archivo es muy reciente o si hay restricciones de red.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                            <button 
                                onClick={handleFallbackOpen} 
                                className="px-8 py-3 bg-white text-black rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition-all active:scale-95"
                            >
                                <Icon name="open_in_new" /> Ver en Microsoft Office
                            </button>
                            <button 
                                onClick={() => window.location.reload()} 
                                className="px-8 py-3 bg-white/10 text-white rounded-xl font-black text-sm border border-white/20 hover:bg-white/20 transition-all"
                            >
                                Reintentar Túnel
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-8 uppercase font-bold tracking-widest bg-black/50 px-3 py-1 rounded">Debug Info: {error}</p>
                    </div>
                ) : (
                    <video 
                        ref={videoRef}
                        src={streamUrl || ''} 
                        className="w-full h-full rounded-2xl shadow-2xl border border-white/10 bg-black"
                        controls
                        autoPlay
                        playsInline
                        preload="auto" // Critical for buffering behavior
                        controlsList="nodownload"
                        onWaiting={handleWaiting}
                        onPlaying={handlePlaying}
                        onCanPlay={handleCanPlay}
                    />
                )}
            </div>

            {/* Footer Branding */}
            <div className="absolute bottom-8 opacity-30 flex items-center gap-2">
                <Icon name="verified_user" className="text-white text-sm" />
                <span className="text-white text-[9px] font-bold uppercase tracking-widest">Premium Secure Streaming Protocol</span>
            </div>
        </div>
    );
};

export default VideoCinema;

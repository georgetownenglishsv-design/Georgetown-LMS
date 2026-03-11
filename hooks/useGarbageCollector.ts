import { useEffect, useRef } from 'react';
import { runBackgroundCleanup } from '../services/db';
import { AppUser } from '../types';

/**
 * Hook to automatically clean up orphaned data in the database.
 * This simulates a background job or "cron" task on the client side.
 * It runs once when the app loads (if the user is an admin-like role), with a small delay.
 */
export const useGarbageCollector = (user: AppUser | null) => {
    const hasRun = useRef(false);

    useEffect(() => {
        // Run for Admins, Secretaries, and SuperAdmins to ensure data health
        if (!user || (user.role !== 'Administrador' && user.role !== 'Secretaría' && !user.isSuperAdmin) || hasRun.current) {
            return;
        }

        const cleanupTask = async () => {
            // Reduced delay to 2 seconds to fix data faster on load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log(" [GC] Garbage Collector Waking Up...");
            await runBackgroundCleanup();
            hasRun.current = true;
        };

        cleanupTask();

    }, [user]); // Dependency on user ensures it runs after login
};
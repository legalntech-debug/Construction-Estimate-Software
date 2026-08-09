'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Helper function to convert VAPID key for browser push subscription
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationManager() {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      registerServiceWorker();
    }
  }, []);

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  async function subscribeButtonHandler() {
    try {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        alert('VAPID public key is missing in environment variables.');
        return;
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Supabase mein subscription save karein
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('push_subscriptions').insert({
          user_id: user.id,
          subscription: sub
        });
      }

      setIsSubscribed(true);
      alert('Notifications enabled successfully!');
    } catch (error: any) {
      console.error('Failed to subscribe the user: ', error);
      alert('Failed to subscribe: ' + (error.message || error));
    }
  }

  if (isSubscribed) return null;

  return (
    <div className="bg-blue-600 text-white p-3 rounded-2xl flex justify-between items-center text-xs mb-4">
      <span>🔔 Din mein updates paane ke liye notifications enable karein!</span>
      <button 
        onClick={subscribeButtonHandler}
        className="bg-white text-blue-600 px-3 py-1.5 rounded-xl font-bold shadow-sm hover:bg-blue-50 transition"
      >
        Enable Notifications
      </button>
    </div>
  );
}
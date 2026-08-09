import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { supabase } from '@/lib/supabase';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@yourcompany.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  try {
    let title = '';
    let body = '';

    // Check karein ki request mein JSON body di gayi hai ya nahi (Cron job ke liye fallback)
    try {
      const json = await request.json();
      title = json.title;
      body = json.body;
    } catch (e) {
      // Agar body nahi hai (Cron Job trigger), toh default Good Morning message use hoga
    }

    // Default Good Morning Message agar request khali ho
    if (!title || !body) {
      title = "☀️ Good Morning! L&T Consultant Services";
      body = "Get your sale estimates and map drafting done 24/7 anytime via L&T Consultant Software. Fast, accurate, and reliable!";
    }

    // Database se sabhi users ke push subscriptions fetch karein
    const { data: subscriptions, error } = await supabase.from('push_subscriptions').select('subscription');
    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, message: 'No active subscribers found.' });
    }

    const notificationPayload = JSON.stringify({ title, body });

    // Sabhi users ko parallel notification bhejein
    const promises = subscriptions.map(async (subItem) => {
      try {
        await webpush.sendNotification(subItem.subscription, notificationPayload);
      } catch (err) {
        console.error('Error sending push to a subscriber:', err);
      }
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true, message: 'Daily broadcast sent successfully at 11:00 AM!' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
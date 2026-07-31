import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: Request) {
  try {
    // TEMPORARY: Direct string pass karke check karein
    const razorpay = new Razorpay({
      key_id: "rzp_test_TK9kvfQQvEx2rQ", 
      key_secret: "iVdR31CP1XIprB3wsNK4gP0h", // Apni sahi secret yahan daalein
    });

    const { amount } = await req.json();
    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    });

    return NextResponse.json({ id: order.id }, { status: 200 });
  } catch (error: any) {
    console.error("Razorpay Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
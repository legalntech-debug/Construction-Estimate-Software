"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { fetchPricingRow, getDisplayPricing } from "@/lib/pricingFetch";
import { getItemRate } from "@/lib/pricing";
import {
  NAME_ADDRESS_CHANGE_LIMIT,
  isRealRef,
  isNameAddressChangeMajor,
  isEstimateExpired,
} from "@/lib/estimateRules";

// Pricing item key for certificates in pricing_config (column case_type). The completion certificate
// uses "completionCertificate"; this page is the CONSTRUCTION certificate.
const CERTIFICATE_PRICING_ITEM = "constructionCertificate";
const FALLBACK_FEE = 21;

// localStorage key shared with the input form (/construction-certificate)
const CERTIFICATE_STORAGE_KEY = "certificatePreview";
const CERTIFICATE_FORM_ROUTE = "/construction-certificate";

// The ref no is created by rpc_save_estimate (same series as the estimates: LnT/26-27/NAME/U001/C0001).
// For a NEW record the RPC ignores any ref sent by the page, so none is generated here.

// Same status value the estimate flow passes to its save RPC
const CERT_SAVE_STATUS = "pending";

// sessionStorage flag shared with the input forms: "the user is going back to the form, keep the data"
const RETURN_TO_FORM_FLAG = "estimateReturnToForm";

// Owner account (always treated as admin, same as the wallet gate)
const OWNER_EMAIL = "legalntech@gmail.com";

// ---------------------------------------------------------------------------
// CHANGE DETECTION (same idea as makeSnapshot in the estimate preview)
// A stable fingerprint of everything the certificate shows. If the fingerprint of the screen equals the
// fingerprint of the saved record, nothing is written to the database (print / PDF / share only).
// ---------------------------------------------------------------------------
const makeCertSnapshot = (e: any, extra?: { bank?: string; inspection?: string; completion?: string }): string => {
  const norm = (v: any) => String(v ?? "").trim().toUpperCase();
  const fd = e?.floor_details && typeof e.floor_details === "object" ? e.floor_details : {};
  const floors: Record<string, number> = {};
  Object.keys(fd).sort().forEach((k) => {
    const a = Number(fd[k]?.area || 0);
    if (a > 0) floors[k] = a;
  });
  return JSON.stringify({
    n: norm(e?.customer_name),
    a: norm(e?.property_address),
    p: Number(String(e?.plot_area ?? "").replace(/,/g, "")) || 0,
    b: Number(e?.total_builtup_area || 0),
    f: floors,
    c: norm(e?.client_name),
    rp: norm(e?.representative),
    bk: norm(extra?.bank),
    i: norm(extra?.inspection),
    d: norm(extra?.completion),
  });
};

type PaymentData = {
  p_payment_status: string;
  p_order_id: string | null;
  p_payment_id: string | null;
  p_user_payment: number;
};

// ---------------------------------------------------------------------------
// WALLET GATE - same rule as the estimate preview. Runs only when a NEW payment is about to start
// (Pay to unlock). Reprints / same-ref updates of an already paid certificate never reach it.
// ---------------------------------------------------------------------------
const MIN_RECHARGE = 100; // Platform minimum recharge amount (INR)
const WALLET_RECHARGE_ROUTE = "/wallet-ledger";

type WalletBlock = { charge: number; balance: number; state: string };

// Flat shape on purpose: discriminated-union narrowing does not work when "strict" is disabled in tsconfig.
type WalletGateResult = { allowed: boolean; block?: WalletBlock; message?: string };

/**
 * Verifies that the logged-in user's wallet balance covers the certificate charge from the pricing table.
 * Admin, CEO, premium and advanced accounts are exempt. Fails closed: if the balance cannot be verified,
 * the user is not allowed to continue to the payment.
 */
async function verifyWalletForNewPayment(args: {
  userId?: string | null;
  fallbackState: string;
  charge: number;
}): Promise<WalletGateResult> {
  const { userId, fallbackState, charge } = args;

  if (!userId) {
    return { allowed: false, message: "Session expired. Please log in again to continue." };
  }

  try {
    // Always read the balance fresh from the database (the cached profile may be stale after a recharge)
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, plan_type, wallet_balance, state")
      .eq("id", userId)
      .maybeSingle();

    if (error || !profile) {
      console.error("[CERTIFICATE WALLET GATE] Profile fetch failed:", error);
      return { allowed: false, message: "Unable to verify wallet balance. Please try again." };
    }

    const role = String(profile.role || "").toLowerCase();
    const plan = String(profile.plan_type || "").toLowerCase();
    const { data: authData } = await supabase.auth.getUser();
    const isOwnerAccount = authData?.user?.email === "legalntech@gmail.com";
    if (role === "admin" || role === "ceo" || plan.includes("premium") || plan.includes("advanced") || isOwnerAccount) {
      return { allowed: true };
    }

    const balance = Number(profile.wallet_balance ?? 0);
    const state = String(profile.state || fallbackState || "").toUpperCase().trim();

    console.log("[CERTIFICATE WALLET GATE]", { userId, state, balance, charge });

    if (!charge || charge <= 0 || balance >= charge) return { allowed: true };

    return { allowed: false, block: { charge, balance, state } };
  } catch (err) {
    console.error("[CERTIFICATE WALLET GATE] Unexpected error:", err);
    return { allowed: false, message: "Unable to verify wallet balance. Please try again." };
  }
}

// A saved certificate ref: a real ref (estimateRules) that is not a DRAFT placeholder or an old temporary "CERT-<timestamp>" id
const isCertRef = (ref?: string | null): boolean => {
  const r = String(ref || "").trim().toUpperCase();
  return !!r && !r.startsWith("DRAFT") && !r.startsWith("CERT-") && isRealRef(ref);
};

// Same paid test as the estimate preview (an estimates row is paid by any of these three columns)
const isPaidRecord = (r: any): boolean =>
  String(r?.platform_payment_status || "").toLowerCase() === "paid" ||
  String(r?.payment_status || "").toLowerCase() === "paid" ||
  String(r?.status || "").toLowerCase() === "paid";

/**
 * Confirms against the database that a ref no really belongs to a PAID certificate.
 * Local flags (React state / localStorage) can be edited by the user, so every action that releases
 * a printout (print, PDF download, share, save of a paid record) is checked here first.
 * Fails closed: a missing record or a network error counts as "not paid".
 */
async function verifyPaidOnServer(refNo?: string | null): Promise<boolean> {
  if (!isCertRef(refNo)) return false;
  try {
    // Certificates are stored in `estimates` (+ mis_records), exactly like estimates
    const { data: est } = await supabase
      .from("estimates")
      .select("*")
      .eq("ref_no", refNo)
      .maybeSingle();
    if (est && isPaidRecord(est)) return true;

    const { data: mis } = await supabase
      .from("mis_records")
      .select("platform_payment_status")
      .eq("ref_no", refNo)
      .maybeSingle();
    return !!mis && String(mis.platform_payment_status || "").toLowerCase() === "paid";
  } catch (err) {
    console.error("[CERTIFICATE PRINT GUARD] Payment verification failed:", err);
    return false;
  }
}

export default function CertificatePreviewPage() {
  const router = useRouter();
  const auth: any = useAuth();
  const user: any = auth?.currentUser ?? auth?.user;
  
  const [estimate, setEstimate] = useState<any>(null);
  const [bankName, setBankName] = useState("SMFG India Home Finance Company Ltd");
  const [inspectionDate, setInspectionDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [signatureDetails, setSignatureDetails] = useState("");
  const [currentRefNo, setCurrentRefNo] = useState("");
  const [isDraft, setIsDraft] = useState(true);
  // `fee` = the amount actually charged. `pricingDisplay` carries the offer details (MRP, % off, savings)
  // from pricing_config, exactly like the estimate preview, so a rate / offer change in pricing shows here.
  const [fee, setFee] = useState<number>(FALLBACK_FEE);
  const [pricingDisplay, setPricingDisplay] = useState({
    mrp: FALLBACK_FEE,
    price: FALLBACK_FEE,
    discountEnabled: false,
    discountPercent: 0,
    savings: 0,
    isFromDB: false,
  });
  const [pricingLoading, setPricingLoading] = useState(true);
  const [walletBlock, setWalletBlock] = useState<WalletBlock | null>(null);
  const [walletChecking, setWalletChecking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  // certificates.id of the saved record (reopen / reprint -> UPDATE the same record)
  const [certificateId, setCertificateId] = useState<string | null>(null);
  // name/address changed > limit or record older than 60 days -> brand new record + new ref no + new payment
  const [needsNewPayment, setNeedsNewPayment] = useState(false);
  const [newPaymentReason, setNewPaymentReason] = useState("");
  const [originalRefNo, setOriginalRefNo] = useState<string | null>(null);
  // payment taken but the save failed -> keep the details so the save can be retried (never charge twice)
  const [pendingPayment, setPendingPayment] = useState<PaymentData | null>(null);
  const isSavingRef = useRef(false);
  const paymentIdRef = useRef<string | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const userPaymentRef = useRef<number | null>(null);
  const currentCaseType = estimate?.estimate_type || estimate?.case_type || "CONSTRUCTION CERTIFICATE";

  // ADMIN CHECK - decided from the database profile (role / user_type) and the owner e-mail, never from a
  // client-side label. `adminChecked` stays false until the profile has been read, so nothing that depends
  // on "admin or not" (load decision, save, print guard) runs on a guess.
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  // Owner (user_id) of the record on screen; differs from the logged-in user when an admin reopens someone's file
  const [recordOwnerId, setRecordOwnerId] = useState<string | null>(null);
  const userCategory = isAdmin ? "ADMIN" : String(user?.category || "ENGINEER").toUpperCase();
  const isAdminReopen = isAdmin && !!recordOwnerId && recordOwnerId !== user?.id;

  // Print guard (same as the estimate preview): browser print is blocked unless this is true
  const [printAuthorized, setPrintAuthorized] = useState(false);
  const printAuthorizedRef = useRef(false);
  const allowPrintRef = useRef(false);
  // Fingerprint of the record as saved in the database (baseline for "unchanged -> do not touch the database")
  const initialSnapRef = useRef<string | null>(null);
  // Saved record row (kept so an admin update can preserve payment fields / status / type exactly)
  const savedRowRef = useRef<any>(null);
  const goingToFormRef = useRef(false);
  const isMountedRef = useRef(false);
  const [validationReason, setValidationReason] = useState("");
  const [useCustomLetterhead, setUseCustomLetterhead] = useState(false);
  const [customHeaderTitle, setCustomHeaderTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [legalText, setLegalText] = useState("IOV APPROVED VALUER A-33162 | BUILDING PERMISSION DEPARTMENT");

  // Load Razorpay Script Dynamically
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Admin detection from the database (profiles.role / profiles.user_type) + owner e-mail
  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }
    setAdminChecked(false);
    (async () => {
      let admin = false;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, user_type")
          .eq("id", user.id)
          .maybeSingle();
        const role = String(profile?.role || "").toLowerCase();
        const type = String(profile?.user_type || "").toUpperCase();
        admin = role === "admin" || role === "ceo" || type === "ADMIN";
        if (!admin) {
          const email = user?.email || (await supabase.auth.getUser())?.data?.user?.email;
          admin = String(email || "").toLowerCase() === OWNER_EMAIL;
        }
      } catch (err) {
        console.error("[CERTIFICATE ADMIN CHECK] failed:", err);
        admin = false; // fail closed: not admin
      }
      if (alive) {
        setIsAdmin(admin);
        setAdminChecked(true);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Resolve the certificate fee from the pricing table (state + user category)
  useEffect(() => {
    let alive = true;
    const targetState = user?.state || estimate?.state_name || "MADHYA PRADESH";
    const pricingCategory = String(user?.user_type || user?.category || "INDIVIDUAL USER").toUpperCase();

    (async () => {
      setPricingLoading(true);
      // Fallback (no DB row): hardcoded pricing.ts rate, no offer shown
      const applyFallback = () => {
        const fallbackPrice = getItemRate(targetState, CERTIFICATE_PRICING_ITEM) || FALLBACK_FEE;
        setFee(fallbackPrice);
        setPricingDisplay({
          mrp: fallbackPrice,
          price: fallbackPrice,
          discountEnabled: false,
          discountPercent: 0,
          savings: 0,
          isFromDB: false,
        });
      };

      try {
        const row = await fetchPricingRow(CERTIFICATE_PRICING_ITEM, targetState, pricingCategory);
        const display = getDisplayPricing(row);
        if (!alive) return;
        if (display.isFromDB && display.price > 0) {
          setFee(display.price);
          setPricingDisplay({
            mrp: display.mrp,
            price: display.price,
            discountEnabled: display.discountEnabled,
            discountPercent: display.discountPercent,
            savings: display.savings,
            isFromDB: true,
          });
          console.log(`💰 [CERTIFICATE DB PRICING] ${targetState} = ₹${display.price}`);
        } else {
          applyFallback();
          console.log(`⚠️ [CERTIFICATE FALLBACK PRICING] ${targetState}`);
        }
      } catch (err) {
        console.error("[CERTIFICATE PRICING ERROR]", err);
        if (alive) applyFallback();
      } finally {
        if (alive) setPricingLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [user?.state, user?.user_type, user?.category, estimate?.state_name]);

  // ---------------------------------------------------------------
  // LOAD the certificate from the input form and decide: paid reprint / new payment / draft.
  // The decision comes from the DATABASE (not from localStorage flags):
  //   - ref no exists + paid + name/address changed <= limit + younger than 60 days -> same record (reprint / update)
  //   - changed more than the limit, or older than 60 days                          -> new record, new ref no, new payment
  //   - no ref no / not paid                                                         -> draft, pay to unlock
  // ---------------------------------------------------------------
  useEffect(() => {
    let alive = true;

    const savedLogo = localStorage.getItem("customLogo");
    if (savedLogo) setLogoUrl(savedLogo);

    // Wait for the admin check: the load decision (new payment rules vs admin reopen) depends on it
    if (!adminChecked) return;

    const savedData = localStorage.getItem(CERTIFICATE_STORAGE_KEY);
    if (!savedData) return;

    let parsed: any;
    try {
      parsed = JSON.parse(savedData);
    } catch (e) {
      console.error("Error parsing certificate data", e);
      return;
    }

    setEstimate(parsed);
    // The input form sends the selected institution as `financial_institution`
    const selectedBank = parsed.financial_institution || parsed.bank_name;
    if (selectedBank) setBankName(selectedBank);
    if (parsed.inspection_date) setInspectionDate(parsed.inspection_date);
    if (parsed.completion_date) setCompletionDate(parsed.completion_date);

    const showDraft = () => {
      const userIdTag = user?.id ? `U${String(user.id).slice(0, 6)}` : (user?.name ? user.name.replace(/\s+/g, '').toUpperCase() : "EXPERT");
      setIsPaid(false);
      setIsDraft(true);
      setCurrentRefNo(`DRAFT-${userIdTag}-${Math.floor(1000 + Math.random() * 9000)}`);
    };

    (async () => {
      if (!isCertRef(parsed.ref_no)) {
        // ADMIN starting a brand new certificate sees it unlocked (admin never pays); everyone else -> draft
        if (isAdmin) {
          setIsPaid(true);
          setIsDraft(false);
          setCurrentRefNo("");
          return;
        }
        showDraft();
        return;
      }
      const refNo: string = parsed.ref_no;
      try {
        // `cert` = the saved record in the estimates table (certificates are stored there like estimates)
        const { data: cert } = await supabase
          .from("estimates")
          .select("*")
          .eq("ref_no", refNo)
          .maybeSingle();

        let paid = !!cert && isPaidRecord(cert);
        const { data: mis } = await supabase
          .from("mis_records")
          .select("*")
          .eq("ref_no", refNo)
          .maybeSingle();
        if (!paid) paid = !!mis && String(mis.platform_payment_status || "").toLowerCase() === "paid";

        if (!alive) return;

        // Baseline fingerprint = the record exactly as stored (core columns + bank/dates kept in the snapshot)
        if (cert) {
          const snap: any = cert.snapshot && typeof cert.snapshot === "object" ? cert.snapshot : {};
          initialSnapRef.current = makeCertSnapshot(cert, {
            bank: snap.bank_name || snap.financial_institution || mis?.bank_name || parsed.financial_institution || parsed.bank_name,
            inspection: snap.inspection_date ?? parsed.inspection_date,
            completion: snap.completion_date ?? parsed.completion_date,
          });
          savedRowRef.current = { ...cert, _mis: mis || null };
          setRecordOwnerId(cert.user_id ?? null);
        }

        // LEGACY record: the ref no exists only in mis_records (no estimates row, e.g. an old CT#### certificate).
        // Its baseline comes from the MIS row, so printing it never goes through a save and never creates a new ref no.
        if (!cert && mis) {
          initialSnapRef.current = makeCertSnapshot(mis, {
            bank: mis.bank_name || parsed.financial_institution || parsed.bank_name,
            inspection: parsed.inspection_date,
            completion: parsed.completion_date,
          });
          savedRowRef.current = null;
          setRecordOwnerId(mis.user_id ?? null);
        }

        // ADMIN reopening ANY certificate: same record, same ref no, no payment, no 15% / 60-day rule.
        // Nothing about payment or ownership is changed by viewing / printing it.
        if (isAdmin && (cert || mis)) {
          orderIdRef.current = mis?.razorpay_order_id ?? cert?.razorpay_order_id ?? null;
          paymentIdRef.current = mis?.razorpay_payment_id ?? cert?.razorpay_payment_id ?? null;
          const adminStored = Number(mis?.amount_paid ?? mis?.user_payment ?? cert?.user_payment ?? 0);
          userPaymentRef.current = adminStored > 0 ? adminStored : null;
          setCertificateId(cert?.id ?? parsed.id ?? null);
          setNeedsNewPayment(false);
          setIsPaid(true);
          setIsDraft(false);
          setCurrentRefNo(refNo);
          return;
        }

        if (!paid && !isAdmin) {
          showDraft();
          return;
        }

        // 15% rule + 60-day rule (same helpers as the estimate preview) - not applied to admin (handled above)
        const changedTooMuch = !!cert && isNameAddressChangeMajor(
          { customer_name: cert.customer_name, property_address: cert.property_address },
          { customer_name: parsed.customer_name, property_address: parsed.property_address }
        );
        const expired = !!cert && isEstimateExpired(cert.created_at);

        if (changedTooMuch || expired) {
          initialSnapRef.current = null;
          savedRowRef.current = null;
          setRecordOwnerId(null);
          setNeedsNewPayment(true);
          setNewPaymentReason(expired ? "EXPIRED_60_DAYS" : "CHANGED");
          setOriginalRefNo(refNo);
          setCertificateId(null);
          setEstimate((prev: any) => (prev ? { ...prev, id: null, ref_no: null } : prev));
          showDraft();
          return;
        }

        // Paid + same record -> keep its payment details so that a re-save never wipes them
        orderIdRef.current = mis?.razorpay_order_id ?? null;
        paymentIdRef.current = mis?.razorpay_payment_id ?? null;
        const storedAmount = Number(mis?.amount_paid ?? mis?.user_payment ?? 0);
        userPaymentRef.current = storedAmount > 0 ? storedAmount : null;

        setCertificateId(cert?.id ?? parsed.id ?? null);
        setIsPaid(true);
        setIsDraft(false);
        setCurrentRefNo(refNo);
      } catch (err) {
        console.error("[CERTIFICATE LOAD] payment status check failed:", err);
        if (alive) showDraft(); // fail closed
      }
    })();

    return () => { alive = false; };
  }, [user?.id, adminChecked, isAdmin]);

  // Current on-screen fingerprint vs the saved one
  const currentSnap = () =>
    makeCertSnapshot(estimate, { bank: bankName, inspection: inspectionDate, completion: completionDate });
  const isUnchangedFromSaved = () =>
    !needsNewPayment && isCertRef(currentRefNo) && !!initialSnapRef.current && currentSnap() === initialSnapRef.current;

  // ---------------------------------------------------------------
  // SAVE (create / update) through rpc_save_estimate (certificates live in estimates + mis_records)
  //   - fresh record or new payment -> new ref no (global sequence) + INSERT
  //   - same ref no (reprint / minor change) -> UPDATE the existing record
  //   - every detail of the form goes into `snapshot`; client / fee / areas are also mirrored into the
  //     mis_records columns that exist
  // ---------------------------------------------------------------
  const handleSaveAndFinalize = async (paymentData?: PaymentData): Promise<boolean> => {
    if (isSavingRef.current) return false;

    const userId = user?.id;
    if (!userId) { alert("User ID not found! Please login again."); return false; }

    // A fresh payment or an admin is always authorized. A "paid" flag alone is NOT trusted (it can be edited in
    // localStorage / React state): the ref no must exist in the database as a paid certificate.
    let isAuthorized: boolean = userCategory === "ADMIN" || !!paymentData;
    if (!isAuthorized && isPaid && !needsNewPayment) {
      isAuthorized = await verifyPaidOnServer(currentRefNo);
    }
    if (!isAuthorized) {
      alert(`Payment of ₹${fee}/- is required to save and print.`);
      return false;
    }

    // Print-only / no change -> the database is not touched at all (same ref no, no update, no new charge).
    // This is also what makes an admin reprint of somebody else's file harmless.
    if (!paymentData && isUnchangedFromSaved()) return true;

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      let activeRefNo: string | null = !needsNewPayment && isCertRef(currentRefNo) ? currentRefNo : null;
      let activeId: string | null = needsNewPayment ? null : certificateId;
      const hadRefNoAtStart = !!activeRefNo;
      // The stored row of the record being updated (null for a fresh / new-payment record)
      const saved: any = hadRefNoAtStart ? savedRowRef.current : null;

      // State has the ref no but not the id -> find the exact record.
      // ADMIN may open any user's record, so the lookup is by ref no only; everybody else is limited to own records.
      if (!activeId && activeRefNo) {
        let q = supabase.from("estimates").select("id, user_id").eq("ref_no", activeRefNo);
        if (!isAdmin) q = q.eq("user_id", userId);
        const { data: found } = await q.maybeSingle();
        if (found) {
          activeId = found.id;
          if (isAdmin && found.user_id) setRecordOwnerId(found.user_id);
        }
      }

      // SAFETY: the page has a ref no but no estimates row exists for it (legacy / mis-only record).
      // Never fall through to the RPC here: with no id it would create a brand new record + a new ref no.
      if (hadRefNoAtStart && !activeId && !paymentData) {
        console.warn("[CERTIFICATE SAVE] No estimates row for", activeRefNo, "- nothing to update, ref no kept.");
        isSavingRef.current = false;
        setIsSaving(false);
        return true;
      }

      // The record keeps its ORIGINAL owner (an admin re-save never moves a file to the admin's account)
      const ownerId: string = (isAdmin && (saved?.user_id || recordOwnerId)) || userId;

      // Duplicate check (only for a fresh record that has no ref no yet) - same rule as the estimate preview,
      // limited to certificates of the same type so an estimate is never overwritten by mistake.
      if (!activeRefNo && !needsNewPayment) {
        const { data: sameOwner } = await supabase
          .from("estimates")
          .select("id, ref_no, customer_name, property_address, estimate_type")
          .eq("user_id", ownerId)
          .eq("estimate_type", currentCaseType)
          .limit(100);
        const norm = (v: any) => String(v ?? "").trim().toUpperCase();
        const duplicate = (sameOwner || []).find(
          (r: any) => norm(r.customer_name) === norm(estimate?.customer_name) && norm(r.property_address) === norm(estimate?.property_address)
        );
        if (duplicate) {
          const confirmOverwrite = confirm(`Duplicate found (Ref: ${duplicate.ref_no}). OK to OVERWRITE?`);
          if (!confirmOverwrite) {
            isSavingRef.current = false;
            setIsSaving(false);
            return false;
          }
          activeId = duplicate.id;
          activeRefNo = duplicate.ref_no;
        }
      }

      // A fresh / new-payment record has no ref no yet: rpc_save_estimate generates it (and returns it below)

      // Payment details: a fresh payment brings its own; a re-save keeps the stored ones
      // (the RPC overwrites razorpay ids / amount in mis_records, so they must be passed again)
      const orderId = paymentData?.p_order_id ?? orderIdRef.current ?? null;
      const paymentId = paymentData?.p_payment_id ?? paymentIdRef.current ?? null;
      const amount = Number(
        paymentData?.p_user_payment ??
        userPaymentRef.current ??
        (hadRefNoAtStart || userCategory === "ADMIN" ? 0 : fee)
      ) || 0;

      const snapshot = {
        ...(estimate || {}),
        id: undefined,
        ref_no: activeRefNo || undefined,
        bank_name: bankName,
        financial_institution: bankName,
        inspection_date: inspectionDate,
        completion_date: completionDate,
        signature_details: signatureDetails,
        user_payment: amount,
        saved_at: new Date().toISOString(),
      };

      // Saved through the SAME rpc as the estimates (rpc_save_estimate): the row goes to `estimates` and is
      // mirrored to mis_records, so ledger / revenue / MIS / reopen work without any change.
      // The certificate type is carried by p_estimate_type; bank, dates etc. are kept in the snapshot.
      // Re-saving an EXISTING record without a fresh payment (owner edit, or admin edit of any file) must not
      // touch its payment state: status / type / payment status are carried over from the stored row.
      const keepStored = !paymentData && !!saved;
      const storedPayStatus: string = saved
        ? String(
            saved.platform_payment_status ??
            saved._mis?.platform_payment_status ??
            (isPaidRecord(saved) ? "paid" : "unpaid")
          )
        : "paid";

      const { data, error } = await supabase.rpc("rpc_save_estimate", {
        p_estimate_id: activeId,
        p_user_id: ownerId,
        p_customer_name: estimate?.customer_name || "GUEST",
        p_snapshot: {
          ...snapshot,
          totalArea: Number(estimate?.total_builtup_area || 0),
          grandTotal: 0,
          property_address: estimate?.property_address || "",
          date: new Date().toISOString(),
        },
        p_fee_standard: Number(estimate?.fee_amount) || 0,
        p_estimate_type: keepStored ? (saved.estimate_type || currentCaseType) : currentCaseType,
        p_plan_type: "BASIC",
        p_rate_per_sqft: 0,
        p_floor_details: estimate?.floor_details && typeof estimate.floor_details === "object" ? estimate.floor_details : {},
        p_client_name: estimate?.client_name || "",
        p_representative: estimate?.representative || "",
        p_plot_area: Number(String(estimate?.plot_area ?? "").replace(/,/g, "")) || 0,
        p_property_address: estimate?.property_address || "",
        p_total_builtup_area: Number(estimate?.total_builtup_area) || 0,
        p_total_construction_cost: 0,
        p_ref_no: activeRefNo,
        p_status: keepStored ? (saved.status || CERT_SAVE_STATUS) : CERT_SAVE_STATUS,
        p_payment_status: paymentData?.p_payment_status || storedPayStatus,
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_user_payment: amount,
      });
      if (error) throw error;

      const result: any = Array.isArray(data) ? data[0] : data;
      const savedId: string | null = result?.estimate_id ?? result?.id ?? null;
      if (!result || !savedId) {
        throw new Error("Certificate record could not be saved (no record returned). Please try again.");
      }
      const savedRef: string = result.ref_no || activeRefNo;

      // Best effort: the estimate rpc has no bank parameter, so store the bank on the MIS row (used by Reopen).
      // A failure here (e.g. RLS) never blocks the certificate.
      try {
        await supabase.from("mis_records").update({ bank_name: bankName || null }).eq("ref_no", savedRef);
      } catch {}

      // New record only: count it on the owner's profile (same as the estimate preview). Best effort.
      if (!hadRefNoAtStart && savedRef !== activeRefNo && !isAdmin) {
        try {
          await supabase.from("profiles").update({ estimate_count: (user?.estimate_count || 0) + 1 }).eq("id", userId);
        } catch {}
      }

      // Success: the saved record is now the baseline for change detection
      initialSnapRef.current = currentSnap();
      savedRowRef.current = {
        ...(saved || {}),
        id: savedId,
        ref_no: savedRef,
        user_id: ownerId,
        estimate_type: keepStored ? (saved.estimate_type || currentCaseType) : currentCaseType,
        status: keepStored ? (saved.status || CERT_SAVE_STATUS) : CERT_SAVE_STATUS,
        platform_payment_status: paymentData?.p_payment_status || storedPayStatus,
      };
      setRecordOwnerId(ownerId);
      orderIdRef.current = orderId;
      paymentIdRef.current = paymentId;
      userPaymentRef.current = amount > 0 ? amount : userPaymentRef.current;
      setCertificateId(savedId);
      setCurrentRefNo(savedRef);
      setEstimate((prev: any) => ({ ...(prev || {}), id: savedId, ref_no: savedRef }));
      setIsPaid(true);
      setIsDraft(false);
      setNeedsNewPayment(false);
      setOriginalRefNo(null);
      setNewPaymentReason("");
      setPendingPayment(null);

      // Keep the saved data + ref no + id so that "Back to Input" returns with everything still filled in
      try {
        localStorage.setItem(
          CERTIFICATE_STORAGE_KEY,
          JSON.stringify({
            ...(estimate || {}),
            id: savedId,
            ref_no: savedRef,
            financial_institution: bankName,
            bank_name: bankName,
            inspection_date: inspectionDate,
            completion_date: completionDate,
            payment_status: paymentData?.p_payment_status || storedPayStatus,
            isPaid: String(paymentData?.p_payment_status || storedPayStatus).toLowerCase() === "paid",
          })
        );
      } catch {}
      return true;
    } catch (err: any) {
      console.error("[CERTIFICATE SAVE ERROR]", err);
      alert("Error: " + (err?.message || "Failed to save certificate"));
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (isBusy || walletChecking) return;

    // WALLET GATE (same as the estimate preview): the balance must cover the pricing-table charge BEFORE the
    // payment starts. Insufficient balance -> recharge prompt; the certificate stays in localStorage.
    setWalletChecking(true);
    setWalletBlock(null);
    try {
      const gate = await verifyWalletForNewPayment({
        userId: user?.id,
        fallbackState: user?.state || estimate?.state_name || "MADHYA PRADESH",
        charge: fee,
      });
      if (!gate.allowed) {
        if (gate.block) setWalletBlock(gate.block);
        else alert(gate.message || "Unable to verify wallet balance. Please try again.");
        return;
      }
    } finally {
      setWalletChecking(false);
    }

    try {
      setIsBusy(true);
      if (typeof window === "undefined" || !(window as any).Razorpay) {
        throw new Error("Payment gateway is still loading. Please try again.");
      }

      // Create a server-side order for the fee resolved from the pricing table
      const orderRes = await fetch("/api/analyze/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: fee }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || "Failed to create order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mockkeyID",
        amount: Math.round(fee * 100), // paise
        currency: "INR",
        order_id: order.id,
        name: `${user?.name || "Er. J. TOMAR"} Valuer Portal`,
        description: "Certificate Verification & Generation Fee",
        handler: async function (response: any) {
          const paymentDetails: PaymentData = {
            p_payment_status: "paid",
            p_order_id: response.razorpay_order_id || order.id || null,
            p_payment_id: response.razorpay_payment_id,
            p_user_payment: fee,
          };
          paymentIdRef.current = response.razorpay_payment_id;
          setPendingPayment(paymentDetails); // cleared by a successful save; lets the user retry without paying again

          // The ref no is generated here (after the payment), exactly like the estimate preview
          const saved = await handleSaveAndFinalize(paymentDetails);
          setIsBusy(false);
          if (saved) {
            alert("Payment Successful! Certificate Generated & Saved to MIS.");
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            alert("Payment received, but the record could not be saved. Press 'RETRY SAVE' (do not pay again). Payment ID: " + response.razorpay_payment_id);
          }
        },
        modal: { ondismiss: () => setIsBusy(false) },
        prefill: {
          name: estimate?.customer_name || "Client",
          email: user?.email || "legalntech@gmail.com",
          contact: user?.phone || "7987561396",
        },
        notes: {
          case_type: "Construction Certificate",
        },
        theme: {
          color: "#2563eb",
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("[CERTIFICATE PAYMENT INIT ERROR]", err);
      alert("Payment initialization failed. " + (err?.message || "Please try again."));
      setIsBusy(false);
    }
  };

  // Save (only if something changed) and confirm the payment against the database before ANY output is released
  // (print / PDF / share). Admin skips the payment check; an admin reopening a saved file never creates a new ref no
  // (the record keeps its ref no, owner and payment fields - see handleSaveAndFinalize).
  const releaseGuard = async (): Promise<boolean> => {
    if (needsNewPayment) {
      alert(`Payment of ₹${fee}/- is required to print this certificate.`);
      return false;
    }
    if (!isAdmin) {
      const verified = await verifyPaidOnServer(currentRefNo);
      if (!verified) { alert("🔒 Payment could not be verified for this certificate. Please complete the payment to print or download it."); return false; }
    }
    const ok = await handleSaveAndFinalize();
    if (ok) await new Promise((r) => setTimeout(r, 500)); // let a new ref no render before capturing / printing
    return ok;
  };

  // Print guard source of truth (same as the estimate preview). Updated from the effect below.
  printAuthorizedRef.current = printAuthorized;

  useEffect(() => {
    let alive = true;
    if (isAdmin) {
      setPrintAuthorized(true);
      return;
    }
    const eligible = isPaid && !needsNewPayment && isCertRef(currentRefNo) && isUnchangedFromSaved();
    if (!eligible) {
      setPrintAuthorized(false);
      return;
    }
    verifyPaidOnServer(currentRefNo).then((ok) => { if (alive) setPrintAuthorized(ok); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isPaid, needsNewPayment, currentRefNo, estimate, bankName, inspectionDate, completionDate]);

  // Switch the guard on for this page only (the print css below is scoped to html[data-print-guard="on"])
  useEffect(() => {
    document.documentElement.setAttribute("data-print-guard", "on");
    return () => {
      document.documentElement.removeAttribute("data-print-guard");
      document.body.classList.remove("print-authorized");
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("print-authorized", printAuthorized);
  }, [printAuthorized]);

  // Ctrl+P / Cmd+P and right-click are blocked unless the certificate is authorized for printing
  useEffect(() => {
    const preventSystemPrint = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        if (printAuthorizedRef.current || allowPrintRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        alert("Printing is locked. It unlocks only after the payment is completed and the certificate is saved.");
      }
    };
    const preventRightClick = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("keydown", preventSystemPrint, true);
    window.addEventListener("contextmenu", preventRightClick);
    return () => {
      window.removeEventListener("keydown", preventSystemPrint, true);
      window.removeEventListener("contextmenu", preventRightClick);
    };
  }, []);

  // Leaving the flow (e.g. to the dashboard) clears the saved input; going back to the input form keeps it
  useEffect(() => {
    isMountedRef.current = true;
    const onPop = () => {
      goingToFormRef.current = true;
      try { sessionStorage.setItem(RETURN_TO_FORM_FLAG, "1"); } catch {}
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      isMountedRef.current = false;
      setTimeout(() => {
        if (!isMountedRef.current && !goingToFormRef.current) {
          try {
            localStorage.removeItem(CERTIFICATE_STORAGE_KEY);
            sessionStorage.removeItem(RETURN_TO_FORM_FLAG);
          } catch {}
        }
      }, 0);
    };
  }, []);

  // System Audit Status text (same idea as the estimate preview)
  useEffect(() => {
    if (!user) return;
    if (isAdmin) {
      setValidationReason(
        isAdminReopen
          ? `Admin view: this certificate belongs to another user. Its Ref No (${currentRefNo || "-"}), owner and payment details stay unchanged when you print, download or share it.`
          : ""
      );
    } else if (isPaid && !needsNewPayment) {
      setValidationReason("");
    } else {
      setValidationReason(
        needsNewPayment
          ? (newPaymentReason === "EXPIRED_60_DAYS"
              ? `⚠️ This certificate is older than 60 days, so it will be treated as a NEW certificate (previous Ref: ${originalRefNo || "-"}). A new REF NO will be generated and a new payment is required to print.`
              : `⚠️ Customer name or property address has changed by more than ${NAME_ADDRESS_CHANGE_LIMIT}%, so this will be treated as a NEW certificate (previous Ref: ${originalRefNo || "-"}). A new REF NO will be generated and a new payment is required to print.`)
          : "Note: To print this certificate, please complete the payment process."
      );
    }
  }, [user, isAdmin, isAdminReopen, isPaid, needsNewPayment, newPaymentReason, originalRefNo, currentRefNo]);

  // Prevent any other path from showing a new-payment certificate as paid
  useEffect(() => {
    if (needsNewPayment && isPaid && !isAdmin) setIsPaid(false);
  }, [needsNewPayment, isPaid, isAdmin]);

  const handleSaveAndPrint = async () => {
    if (!isAdmin && (isDraft || !isPaid)) {
      handleRazorpayPayment();
      return;
    }
    if (isBusy || isSaving) return;
    setIsBusy(true);
    try {
      if (!(await releaseGuard())) return;
      // Release the printout for this in-app print (payment + save + server check are all done at this point)
      document.body.classList.add("print-authorized");
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            allowPrintRef.current = true;
            const restore = () => document.body.classList.toggle("print-authorized", printAuthorizedRef.current);
            window.addEventListener("afterprint", restore, { once: true });
            try {
              window.print();
            } finally {
              setTimeout(() => { allowPrintRef.current = false; }, 1000);
            }
            resolve();
          })
        )
      );
    } catch (err) {
      console.error("Print failed", err);
    } finally {
      setIsBusy(false);
    }
  };

  // ---------------------------------------------------------------
  // PDF export (download + share). Requires: npm i html2canvas jspdf
  // ---------------------------------------------------------------
  const pdfFileName = `Certificate_${(currentRefNo || "draft").replace(/[^\w-]+/g, "_")}.pdf`;

  const buildPdfBlob = async (): Promise<Blob> => {
    const el = document.getElementById("certificate-preview-container");
    if (!el) throw new Error("Certificate container not found");

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      // Skip on-screen only controls (class "print:hidden")
      ignoreElements: (node: Element) => node.classList?.contains("print:hidden"),
      // html2canvas draws <input> text clipped / not at all (bank name cut at the bottom, the letterhead line
      // missing). In the cloned DOM every text input is swapped for a plain span with the same value + styling,
      // so the PDF shows exactly what the page shows. The live page is not touched.
      onclone: (clonedDoc: Document) => {
        clonedDoc.querySelectorAll("input[type='text'], input:not([type])").forEach((node) => {
          const input = node as HTMLInputElement;
          const cs = clonedDoc.defaultView?.getComputedStyle(input);
          const span = clonedDoc.createElement("span");
          span.textContent = input.value || "";
          span.style.display = input.classList.contains("w-full") ? "block" : "inline-block";
          if (cs) {
            span.style.width = cs.width;
            span.style.minHeight = cs.height;
            span.style.font = cs.font;
            span.style.fontWeight = cs.fontWeight;
            span.style.textAlign = cs.textAlign;
            span.style.textTransform = cs.textTransform;
            span.style.letterSpacing = cs.letterSpacing;
            span.style.color = cs.color;
            span.style.borderBottom = cs.borderBottom;
            span.style.padding = cs.padding;
            span.style.margin = cs.margin;
            span.style.boxSizing = "border-box";
            span.style.lineHeight = "1.5";
            span.style.overflow = "visible";
          }
          input.parentNode?.replaceChild(span, input);
        });
      },
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;
    const img = canvas.toDataURL("image/jpeg", 0.95);

    // Slice the tall image across multiple A4 pages
    let offsetY = 0;
    let remaining = imgH;
    pdf.addImage(img, "JPEG", 0, offsetY, pageW, imgH);
    remaining -= pageH;
    while (remaining > 0) {
      offsetY -= pageH;
      pdf.addPage();
      pdf.addImage(img, "JPEG", 0, offsetY, pageW, imgH);
      remaining -= pageH;
    }
    return pdf.output("blob");
  };

  const triggerDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (isBusy) return;
    try {
      setIsBusy(true);
      if (!(await releaseGuard())) return;
      triggerDownload(await buildPdfBlob());
    } catch (err: any) {
      alert("PDF download failed: " + (err?.message || ""));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSharePdf = async () => {
    if (isBusy) return;
    try {
      setIsBusy(true);
      if (!(await releaseGuard())) return;
      const blob = await buildPdfBlob();
      const file = new File([blob], pdfFileName, { type: "application/pdf" });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Construction Certificate" });
      } else {
        // Browsers without file sharing support: fall back to download
        triggerDownload(blob);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") alert("Share failed: " + (err?.message || ""));
    } finally {
      setIsBusy(false);
    }
  };

  if (!adminChecked) {
    return <div className="p-10 text-center font-sans text-gray-500 font-bold">Loading...</div>;
  }

  if (!estimate) {
    return (
      <div className="p-10 text-center font-sans">
        <p className="text-gray-600 font-bold mb-4">No certificate data found.</p>
        <button 
          onClick={() => router.push(CERTIFICATE_FORM_ROUTE)}
          className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  const floorDetails = estimate.floor_details || {};
  const sortedFloors = Object.keys(floorDetails).filter(
    (floor) => floorDetails[floor]?.selected || floorDetails[floor]?.area > 0
  );

  return (
    <div className="bg-white min-h-screen relative font-sans text-sm p-8 md:p-12 print:p-0">
      <style jsx global>{`
        @media print {
          /* PRINT GUARD: nothing is printed unless <body> has "print-authorized" (paid + saved + confirmed, or admin) */
          html[data-print-guard="on"] body:not(.print-authorized) > * {
            display: none !important;
          }
          html[data-print-guard="on"] body:not(.print-authorized)::before {
            content: "🔒 PRINT LOCKED\\A Printing unlocks only after the payment is completed and the certificate is saved.";
            display: block !important;
            white-space: pre-line !important;
            text-align: center !important;
            font: 700 16pt Arial, sans-serif !important;
            color: #cc0000 !important;
            margin: 40mm 15mm 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          .bg-white.min-h-screen, .bg-white.min-h-screen * {
            visibility: visible !important;
          }
          .bg-white.min-h-screen {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            background: white !important;
            box-shadow: none !important;
          }
          .print\:hidden {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 0mm;
          }
        }
      `}</style>

      <div id="certificate-preview-container" className="certificate-sheet max-w-4xl mx-auto bg-white p-8 relative overflow-hidden">
        
        {isDraft && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <span className="text-red-500/15 font-extrabold text-[110px] tracking-widest uppercase transform -rotate-45 select-none">
              DRAFT
            </span>
          </div>
        )}

        {isDraft && (
          <div className="bg-amber-500 text-white text-center py-2 font-bold uppercase tracking-widest text-xs mb-4 rounded print:hidden shadow relative z-10">
            ⚠️ DRAFT PREVIEW MODE - COMPLETE PAYMENT (₹{fee}) TO REMOVE WATERMARK & UNLOCK OFFICIAL CERTIFICATE
          </div>
        )}

        {['ENGINEER', 'ARCHITECT', 'ADMIN'].includes(userCategory) && (
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left print:hidden shadow-sm relative z-10">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="letterheadToggle"
                checked={useCustomLetterhead}
                onChange={(e) => setUseCustomLetterhead(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="letterheadToggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none uppercase tracking-wider">
                Activate Custom Letterhead Mode (For Rented Engineers/Architects)
              </label>
            </div>
            {useCustomLetterhead && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 mt-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Custom Header Title</label>
                  <input
                    type="text"
                    placeholder="e.g., VERMA & ASSOCIATES"
                    value={customHeaderTitle}
                    onChange={(e) => setCustomHeaderTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-black font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Custom Subtitle / Designations</label>
                  <input
                    type="text"
                    placeholder="e.g., Chartered Engineer & Govt. Approved Valuer"
                    value={customSubtitle}
                    onChange={(e) => setCustomSubtitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-black font-medium"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-6 border-b-2 border-black pb-4 relative z-10">
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className="w-1/3 text-[11px] uppercase font-bold text-slate-700 align-middle leading-tight">
                  {useCustomLetterhead ? (
                    <p className="text-base text-black font-bold uppercase">{customHeaderTitle || "ENTER HEADER TITLE"}</p>
                  ) : (
                    <>
                      <p>T&CP 23IND-IER050924212</p>
                    </>
                  )}
                </td>

                <td className="w-1/3 text-center align-middle py-1">
                  {useCustomLetterhead ? (
                    <div className="relative group cursor-pointer border border-dashed border-gray-400 p-1 rounded inline-flex items-center justify-center h-16 w-32 mx-auto">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Custom Logo" className="h-14 w-auto object-contain" />
                      ) : (
                        <div className="text-center text-[9px] text-gray-500 font-bold uppercase">Insert Logo</div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              const base64 = reader.result as string;
                              setLogoUrl(base64);
                              localStorage.setItem("customLogo", base64);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <img src="/logo.jpg" alt="Logo" className="h-16 w-auto object-contain mx-auto" />
                  )}
                </td>

                <td className="w-1/3 text-[11px] text-right font-bold text-slate-700 align-middle leading-tight">
                  {useCustomLetterhead ? (
                    <p className="text-xs text-black font-medium uppercase">{customSubtitle || "ENTER DESIGNATION"}</p>
                  ) : (
                    <>
                      <p>203, MAYUR COMPLEX, 49 SUTAR GALI,</p>
        <p>JAIL ROAD, INDORE (M.P)</p>
        <p>CONTACT NO. 8103804355 / 79875-61396 </p>
        <p>Gmail: legalntech@gmail.com</p>
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-3 text-center font-bold text-slate-700 uppercase leading-normal border-t pt-2">
            <input
              type="text"
              value={legalText}
              onChange={(e) => setLegalText(e.target.value)}
              disabled={!useCustomLetterhead}
              className={`w-full text-xs font-bold border-none text-center uppercase tracking-wider ${!useCustomLetterhead ? "bg-transparent cursor-default" : "bg-white border border-slate-200 py-1"}`}
            />
          </div>
          
          <hr className="w-full border-t border-black my-2" />

          <div className="flex justify-between items-center text-xs px-1 font-semibold">
            <span>
              <strong>REF NO:</strong> <span className="font-mono font-bold text-slate-900">{currentRefNo}</span>
            </span>
            <span><strong>DATE:</strong> {new Date().toLocaleDateString('en-IN')}</span>
          </div>
        </div>

        <div className="space-y-4 text-justify text-slate-900 leading-relaxed relative z-10 text-xs sm:text-sm">
          <p className="italic text-gray-600 print:hidden">
            (To be submitted at the time of Home Loan disbursement)
          </p>

          <div>
            <p className="font-bold">To,</p>
            <div className="flex items-center gap-2 mt-1">
              <input 
                type="text" 
                value={bankName} 
                onChange={(e) => setBankName(e.target.value)}
                className="font-bold border-b border-dashed border-gray-400 bg-transparent w-full focus:outline-none focus:border-black text-sm"
              />
            </div>
          </div>

          <div>
            <p className="font-bold uppercase tracking-wide">
              Subject : Certificate regarding Construction Work for the Building (termed as Property) of {estimate.customer_name}
            </p>
          </div>

          <p className="font-medium uppercase leading-normal">
            <strong>Property Address:</strong> {estimate.property_address}
          </p>

          <p>
            Admeasuring{" "}
            {sortedFloors.length > 0 ? sortedFloors.map((floor, idx) => {
              const area = floorDetails[floor]?.area || 0;
              const prefix = idx === 0 ? "" : idx === sortedFloors.length - 1 ? " and " : ", ";
              return `${prefix}${floor.toLowerCase()} area ${area} sq.ft`;
            }).join("") : `${estimate.total_builtup_area || 1000} sq.ft`}
            {` and total area is ${estimate.total_builtup_area || 1000} sq.ft of Built up area contracted by `}
            <strong>{estimate.customer_name}</strong>.
          </p>

          <p>Sir / Madam,</p>

          <p>
            I / We <strong>{user?.name || "Er. J. Tomar"}</strong>, having License Number <strong>T&CP 23IND-IER050924212</strong> have undertaken assignment as Engineer / Licensed Engineer appointed by <strong>{estimate.customer_name}</strong> for checking and certifying the construction work of the Building as per IS code Standards and following Building By laws / norms.
          </p>

          <p>
            Based on the site inspection conducted by us on date 
            <input 
              type="text" 
              placeholder="DD/MM/YYYY" 
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              className="mx-2 px-2 py-0.5 text-center border-b border-black text-xs font-mono w-28 bg-transparent"
            /> 
            for the building, hereby certify that the construction is completed on date 
            <input 
              type="text" 
              placeholder="DD/MM/YYYY" 
              value={completionDate}
              onChange={(e) => setCompletionDate(e.target.value)}
              className="mx-2 px-2 py-0.5 text-center border-b border-black text-xs font-mono w-28 bg-transparent"
            /> 
            and the Built up structure is strictly as per sanctioned plan and / or building by laws.
          </p>

          <div className="pt-4 mt-6">
            <p className="font-bold mb-4">Yours Faithfully,</p>
            
            <div className="max-w-md border border-slate-300 rounded-lg p-4 bg-slate-50/50">
              {isPaid ? (
                <div className="flex flex-row items-center justify-between gap-4">
                  <div className="flex flex-col items-center">
                    <QRCodeSVG 
                      value={`${typeof window !== 'undefined' ? window.location.origin : 'https://construction-estimate-software.vercel.app'}/verify-estimate?ref=${currentRefNo}`} 
                      size={65} 
                      level="H" 
                    />
                    <p className="text-[8px] mt-1 text-gray-500 font-bold text-center">SCAN TO VERIFY</p>
                  </div>

                  <div className="text-[10px] text-blue-900 border border-blue-200 bg-blue-50 p-2.5 rounded text-left w-full shadow-sm">
                    <p className="font-bold border-b border-blue-200 mb-1">✓ VERIFIED SIGNATURE</p>
                    <p className="font-bold">{user?.name || "Er. J. TOMAR"}</p>
                    <p className="mt-1 break-words">{signatureDetails || "Digitally Verified & Approved"}</p>
                  </div>
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center text-center">
                  <p className="text-xs text-red-500 font-bold italic">🔒 Digital Signature & Barcode Locked (Complete ₹{fee} Payment below to Unlock)</p>
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-black w-72 pt-1">
              <p className="text-xs font-bold uppercase tracking-wide">(Seal and Stamp of Engineers / Firm)</p>
            </div>
          </div>
        </div>

      </div>

      {/* Insufficient wallet balance -> recharge prompt (same as the estimate preview) */}
      {walletBlock && (() => {
        const shortfall = Math.max(0, walletBlock.charge - walletBlock.balance);
        const rechargeAmount = Math.max(MIN_RECHARGE, Math.ceil(shortfall));
        return (
          <div className="print:hidden fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2.5 text-xl">⚠️</div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Insufficient Wallet Balance</h2>
                  <p className="text-xs text-slate-500">
                    Your wallet must cover the service charge before the payment can start.
                  </p>
                </div>
              </div>

              <div className="mb-4 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">🎯 Service Charge</span>
                  <span className="font-semibold text-gray-800">₹{walletBlock.charge}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-2">
                  <span className="text-gray-600">💼 Your Balance</span>
                  <span className="font-semibold text-gray-800">₹{walletBlock.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-2">
                  <span className="font-semibold text-gray-700">⚠️ Shortfall</span>
                  <span className="font-bold text-red-600">₹{shortfall.toFixed(2)}</span>
                </div>
                {walletBlock.state && (
                  <div className="flex justify-between pt-1">
                    <span className="text-xs text-gray-500">State</span>
                    <span className="text-xs font-semibold text-gray-700">{walletBlock.state}</span>
                  </div>
                )}
              </div>

              <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
                Recharge at least <span className="font-bold">₹{rechargeAmount}</span> to continue.
                Your certificate is kept, so you can return to this preview after recharging and pay again.
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWalletBlock(null)}
                  className="flex-1 cursor-pointer rounded-lg border border-slate-300 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`${WALLET_RECHARGE_ROUTE}?recharge=1&from=${encodeURIComponent("Certificate")}`)}
                  className="flex-1 cursor-pointer rounded-lg bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-700"
                >
                  Recharge Now →
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {validationReason && (
        <div
          className={`print:hidden max-w-4xl mx-auto mt-6 p-4 border text-left ${
            !isPaid || needsNewPayment ? "bg-amber-50 border-amber-500 text-amber-900" : "bg-emerald-50 border-emerald-500 text-emerald-900"
          }`}
        >
          <p className="font-bold uppercase text-xs tracking-wider mb-1">📋 System Audit Status</p>
          <p className="text-sm font-medium">{validationReason}</p>
        </div>
      )}

      {/* Offer banner - dynamic from pricing_config (rate, MRP, % off), same as the estimate preview */}
      {!isPaid && userCategory !== "ADMIN" && (
        <div className="print:hidden max-w-4xl mx-auto mt-10 -mb-6 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-dashed border-amber-400 rounded-xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-3">
            <span className="bg-red-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded shadow uppercase tracking-wider animate-pulse">
              ⚡ LIMITED TIME DEAL
            </span>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 uppercase">
                Construction Completion Certificate & Verified Report
              </h4>
              <p className="text-xs text-slate-600 font-medium">
                Includes Instant PDF Download, Digital Sealing & Verification QR Code.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-amber-200 shadow-inner">
            <div className="text-right">
              {pricingLoading ? (
                <span className="text-xs text-slate-500 font-bold">Loading price...</span>
              ) : (
                <>
                  {pricingDisplay.discountEnabled && pricingDisplay.discountPercent > 0 && (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-gray-400 line-through font-semibold">
                        ₹ {pricingDisplay.mrp}/-
                      </span>
                      <span className="bg-green-100 text-green-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {pricingDisplay.discountPercent}% OFF
                      </span>
                    </div>
                  )}
                  <div className="text-lg font-black text-emerald-600 leading-tight">
                    ₹ {pricingDisplay.price} <span className="text-xs font-bold text-slate-700">Only</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-start gap-4 mt-10 mb-12 print:hidden border-t border-slate-200 pt-6 font-sans max-w-4xl mx-auto">
        {isPaid ? (
          <>
            <button
              onClick={handleSaveAndPrint}
              disabled={isSaving || isBusy}
              className="bg-blue-600 text-white px-8 py-3 rounded shadow-md hover:bg-blue-700 transition font-bold"
            >
              {isSaving ? "SAVING..." : "PRINT CERTIFICATE"}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isBusy}
              className="bg-emerald-600 text-white px-8 py-3 rounded shadow-md hover:bg-emerald-700 transition font-bold disabled:opacity-60"
            >
              {isBusy ? "PLEASE WAIT..." : "DOWNLOAD PDF"}
            </button>
            <button
              onClick={handleSharePdf}
              disabled={isBusy}
              className="bg-indigo-600 text-white px-8 py-3 rounded shadow-md hover:bg-indigo-700 transition font-bold disabled:opacity-60"
            >
              SHARE
            </button>
          </>
        ) : pendingPayment ? (
          <button
            onClick={async () => {
              const ok = await handleSaveAndFinalize(pendingPayment);
              if (ok) alert("Certificate saved.");
            }}
            disabled={isSaving}
            className="bg-orange-600 text-white px-8 py-3 rounded shadow-md hover:bg-orange-700 transition font-bold disabled:opacity-60"
          >
            {isSaving ? "SAVING..." : "RETRY SAVE (PAYMENT ALREADY RECEIVED)"}
          </button>
        ) : (
          <button
            onClick={handleRazorpayPayment}
            disabled={pricingLoading || isBusy || walletChecking}
            className="bg-green-600 text-white px-8 py-3 rounded shadow-md hover:bg-green-700 transition font-bold animate-pulse disabled:opacity-60 disabled:animate-none"
          >
            {pricingLoading
              ? "LOADING PRICE..."
              : walletChecking
              ? "CHECKING WALLET..."
              : `PAY TO REMOVE DRAFT & UNLOCK (₹${fee})`}
          </button>
        )}

        <button
          onClick={() => {
            // Keep the data (with ref no / id) so the input form comes back filled in - same as the estimate preview
            goingToFormRef.current = true;
            try { sessionStorage.setItem(RETURN_TO_FORM_FLAG, "1"); } catch {}
            router.push(CERTIFICATE_FORM_ROUTE);
          }}
          className="bg-gray-600 text-white px-8 py-3 rounded shadow-md hover:bg-gray-700 transition font-bold"
        >
          BACK TO INPUT
        </button>
      </div>
    </div>
  );
}
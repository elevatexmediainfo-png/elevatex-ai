import { CouponsManager } from "./coupons-manager";

export default function AdminCouponsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-2 text-neutral-900">Coupon Codes</h1>
        <p className="mt-1 text-body-sm text-neutral-500">
          CREDITS coupons grant credits directly; PERCENT/FIXED coupons discount a credit-package purchase at
          checkout.
        </p>
      </div>
      <CouponsManager />
    </div>
  );
}

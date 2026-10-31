import { Button } from "@/components/ui/button";
import CheckoutButton from "@/components/ui/checkout-button";
import { auth } from "@clerk/nextjs/server";
import { isPaidUserForUser } from "@/lib/account-server";

export default async function ExtraUserSettings() {
  const { userId } = await auth();
  const isPaid = await isPaidUserForUser(userId);

  return (
    <div className=" top-4 right-4 flex items-center gap-4 max-w-6xl mx-auto ">
      <div className="sm:block">{!isPaid && <CheckoutButton />}</div>


    </div>
  );
}

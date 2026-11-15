import { isEmail, normalizeInquiryPhone as normalizePhone } from "./contact.ts";
import { t as defaultTranslator, type Translator } from "../i18n/index.ts";
export { normalizePhone };
export const deliveryMethods = ["branch", "courier"] as const;
export type DeliveryMethod = (typeof deliveryMethods)[number];
export const paymentMethods = ["online", "transfer", "invoice"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
const deliveryAddressErrors = {
  branch: "checkout.errorBranch",
  courier: "checkout.errorCourier",
} as const;
export interface CheckoutInput {
  name: string;
  phone: string;
  email: string;
  city: string;
  cityRef?: string;
  branchRef?: string;
  street?: string;
  streetRef?: string;
  house?: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  courierComment?: string;
  address: string;
  delivery: DeliveryMethod;
  payment?: PaymentMethod;
  comment: string;
  consent: boolean;
}
// Contact data lives in React memory only and is never persisted to browser storage.
export const initialCheckout: CheckoutInput = {
  name: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  delivery: "branch",
  payment: "online",
  comment: "",
  consent: false,
};
export type CheckoutErrors = Partial<Record<keyof CheckoutInput, string>>;
export function validateCheckout(
  data: Partial<Record<keyof CheckoutInput, unknown>>,
  t: Translator = defaultTranslator,
): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (
    typeof data.name !== "string" ||
    data.name.length > 160 ||
    !/^\S.{0,79}\s+\S.{0,79}$/u.test(data.name.trim())
  )
    errors.name = t("checkout.text12");
  if (!normalizePhone(data.phone)) errors.phone = t("checkout.text13");
  if (!isEmail(data.email)) errors.email = t("checkout.text14");
  if (
    typeof data.city !== "string" ||
    data.city.trim().length < 2 ||
    data.city.length > 120
  )
    errors.city = t("checkout.text15");
  const delivery = deliveryMethods.find((method) => method === data.delivery);
  if (!delivery) errors.delivery = t("checkout.text17");
  if (
    typeof data.address !== "string" ||
    data.address.trim().length < (delivery === "courier" ? 3 : 1) ||
    data.address.length > 250
  )
    errors.address = t(
      delivery ? deliveryAddressErrors[delivery] : "checkout.text16",
    );
  if (delivery === "courier") {
    for (const field of ["street", "house"] as const) {
      if (
        typeof data[field] !== "string" ||
        !data[field].trim() ||
        data[field].length > (field === "street" ? 120 : 20)
      )
        errors[field] = t(
          field === "street" ? "delivery.selectStreet" : "delivery.enterHouse",
        );
    }
    for (const field of ["apartment", "entrance", "floor"] as const)
      if (
        data[field] !== undefined &&
        (typeof data[field] !== "string" || data[field].length > 20)
      )
        errors[field] = t("delivery.addressInvalid");
  }
  if (
    data.payment !== undefined &&
    !paymentMethods.some((method) => method === data.payment)
  )
    errors.payment = t("checkout.errorPayment");
  if (
    data.comment !== undefined &&
    (typeof data.comment !== "string" || data.comment.length > 1000)
  )
    errors.comment = t("checkout.text18");
  if (
    data.courierComment !== undefined &&
    (typeof data.courierComment !== "string" ||
      data.courierComment.length > 500)
  )
    errors.courierComment = t("checkout.text18");
  if (data.consent !== true) errors.consent = t("checkout.text19");
  return errors;
}

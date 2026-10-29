// Everything a staff role can be allowed to do in the dashboard. Keys are
// stored on StaffRole.permissions; the client builds the role form from
// GET /staff/permissions and hides menus with the same keys.
export const PERMISSION_GROUPS = [
  {
    group: "Dashboard",
    permissions: [
      { key: "dashboard.view", label: "View dashboard & sales figures" },
    ],
  },
  {
    group: "Products",
    permissions: [
      { key: "product.view", label: "View products" },
      { key: "product.create", label: "Add products" },
      { key: "product.update", label: "Edit products" },
      { key: "product.delete", label: "Delete products" },
      { key: "stock.manage", label: "Manage low stock" },
      { key: "category.manage", label: "Manage categories" },
      { key: "brand.manage", label: "Manage brands" },
      { key: "attribute.manage", label: "Manage attributes" },
      { key: "sizeChart.manage", label: "Manage size charts" },
    ],
  },
  {
    group: "Orders",
    permissions: [
      { key: "order.view", label: "View orders" },
      { key: "order.update", label: "Update orders (status, courier, items)" },
      { key: "order.delete", label: "Delete orders" },
      { key: "return.manage", label: "Process returns" },
      { key: "pos.use", label: "Use POS" },
    ],
  },
  {
    group: "Marketing",
    permissions: [
      { key: "coupon.manage", label: "Manage coupons" },
      { key: "flashSale.manage", label: "Manage flash sale" },
      { key: "landingPage.manage", label: "Manage landing pages" },
    ],
  },
  {
    group: "Website",
    permissions: [
      { key: "homepage.manage", label: "Manage homepage (sliders, banners, popups, testimonials, clients, sample works)" },
      { key: "page.manage", label: "Manage pages & FAQ" },
      { key: "blog.manage", label: "Manage blogs" },
    ],
  },
  {
    group: "Reports & Expenses",
    permissions: [
      { key: "report.view", label: "View reports & analytics" },
      { key: "expense.manage", label: "Manage expenses" },
    ],
  },
  {
    group: "Customers",
    permissions: [{ key: "customer.manage", label: "View & block customers" }],
  },
  {
    group: "Settings",
    permissions: [
      { key: "setting.manage", label: "Site, payment, courier, SMS & shipping settings" },
    ],
  },
] as const;

export type Permission =
  (typeof PERMISSION_GROUPS)[number]["permissions"][number]["key"];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

// What a staff member needs to call an endpoint:
//   null       -> any signed-in staff (own profile, cart, notifications, ...)
//   Permission -> that permission
//   array      -> any one of them
//   undefined  -> no rule, so staff are refused (safe default)
type Rule = Permission | Permission[] | null | undefined;

const isRead = (method: string) => method === "GET";

// `path` is the request path under /api/v1, e.g. "/orders/abc/status"
export const requiredStaffPermission = (path: string, method: string): Rule => {
  const [, base = "", ...rest] = path.split("/");
  const sub = `/${rest.join("/")}`;

  switch (base) {
    // Personal / shopper endpoints any signed-in account uses
    case "auth":
    case "cart":
    case "notifications":
    case "payments":
    case "reviews":
      return null;

    case "analytics":
      return sub.startsWith("/admin") ? "dashboard.view" : null;

    case "products":
      if (sub.startsWith("/generate-sku")) return ["product.create", "product.update"];
      if (method === "DELETE" || sub.startsWith("/bulk-delete")) return "product.delete";
      if (method === "POST") return "product.create";
      return "product.update";
    case "ai":
      return sub.startsWith("/analyze-business")
        ? "report.view"
        : ["product.create", "product.update"];
    case "low-stock":
      return "stock.manage";
    case "categories":
      return "category.manage";
    case "brands":
      return "brand.manage";
    case "attributes":
      return "attribute.manage";
    case "size-charts":
      // The product form lists size charts
      return isRead(method)
        ? ["sizeChart.manage", "product.create", "product.update"]
        : "sizeChart.manage";

    case "orders":
      // Placing / listing their own orders, like any shopper
      if ((sub === "/" && method === "POST") || sub.startsWith("/my-orders")) {
        return null;
      }
      if (method === "DELETE" || sub.startsWith("/bulk-delete")) return "order.delete";
      if (isRead(method)) return "order.view";
      return "order.update";
    case "abandoned-checkouts":
      return method === "DELETE" ? "order.delete" : "order.view";
    case "order-returns":
      return "return.manage";
    case "blocked-phones":
      return "order.update";
    case "wholesale-requests":
      return isRead(method) ? "order.view" : "order.update";
    case "pos":
      // Editing an order item picks products from the POS catalogue
      return sub.startsWith("/products") && isRead(method)
        ? ["pos.use", "order.update"]
        : "pos.use";

    case "coupons":
      return "coupon.manage";
    case "flash-sale":
      return "flashSale.manage";
    case "landing-pages":
      return "landingPage.manage";

    case "hero-sliders":
    case "home-promo":
    case "home-category-sections":
    case "testimonials":
    case "client-logos":
    case "popups":
    case "sample-works":
      return "homepage.manage";
    case "pages":
    case "faqs":
      return "page.manage";
    case "blogs":
      return "blog.manage";

    case "sales-report":
    case "profit-loss":
    case "platform-report":
    case "district-report":
    case "customer-segment-report":
      return "report.view";
    case "expenses":
      return "expense.manage";

    case "admin":
      // Customer list / block / delete. Admin-account routes are
      // SUPER_ADMIN-only at the route level anyway.
      return "customer.manage";

    case "site-settings":
    case "shipping-settings":
    case "gtm-settings":
    case "payment-settings":
    case "courier-settings":
    case "sms-settings":
    case "shops":
      return "setting.manage";

    // Includes /staff: roles and staff accounts are for full admins only
    default:
      return undefined;
  }
};

export const hasStaffPermission = (granted: string[], rule: Rule) => {
  if (rule === null) return true;
  if (rule === undefined) return false;
  const needed = Array.isArray(rule) ? rule : [rule];
  return needed.some((p) => granted.includes(p));
};

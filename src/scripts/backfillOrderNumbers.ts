import { prisma } from "../app/lib/prisma";
import { generateOrderNumber } from "../app/utils/generateOrderNumber";

async function main() {
  const orders = await prisma.order.findMany({
    where: { orderNumber: null },
    select: { id: true, orderType: true, orderSeq: true },
  });

  console.log(`Backfilling orderNumber for ${orders.length} orders...`);

  for (const order of orders) {
    await prisma.order.update({
      where: { id: order.id },
      data: { orderNumber: generateOrderNumber(order.orderType, order.orderSeq) },
    });
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

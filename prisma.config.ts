// .env shifrlangan (dotenvx) — .env.keys yoki DOTENV_PRIVATE_KEY orqali ochiladi
import "@dotenvx/dotenvx/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
});

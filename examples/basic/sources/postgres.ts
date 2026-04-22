import { defineSource } from "@otter-sh/core";

export default defineSource({
  streams: {
    customers: {
      write_disposition: "merge",
      primary_key: "id",
      incremental: { cursor_field: "created_at" },
    },
    orders: {
      write_disposition: "append",
      incremental: { cursor_field: "created_at" },
    },
  },
});

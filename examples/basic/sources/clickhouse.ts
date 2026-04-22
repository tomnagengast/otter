import { defineSource } from "@otter/core";

export default defineSource({
  streams: {
    events: {
      write_disposition: "append",
      incremental: { cursor_field: "created_at", initial_value: "2026-04-20" },
    },
  },
});

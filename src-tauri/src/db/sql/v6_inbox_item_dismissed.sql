-- v6_inbox_item_dismissed: local Done/dismiss flag for inbox items.
ALTER TABLE inbox_item_state ADD COLUMN dismissed INTEGER NOT NULL DEFAULT 0;

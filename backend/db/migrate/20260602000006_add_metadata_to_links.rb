class AddMetadataToLinks < ActiveRecord::Migration[8.1]
  # Parity with notes/courses/units and the promised future-media flexibility.
  # Bulk link payloads (Hermes/OpenClaw) may carry a metadata object.
  def change
    add_column :links, :metadata, :jsonb, null: false, default: {}
  end
end

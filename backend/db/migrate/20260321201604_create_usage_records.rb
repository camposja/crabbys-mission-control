class CreateUsageRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :usage_records do |t|
      t.string  :agent_id
      t.string  :model_id
      t.integer :input_tokens,  default: 0
      t.integer :output_tokens, default: 0
      t.decimal :cost_usd,      precision: 10, scale: 6, default: 0
      t.datetime :recorded_at,  null: false
      t.jsonb   :metadata,      default: {}

      t.timestamps
    end

    add_index :usage_records, :agent_id
    add_index :usage_records, :model_id
    add_index :usage_records, :recorded_at
  end
end

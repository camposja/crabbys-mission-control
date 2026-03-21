class CreateMemories < ActiveRecord::Migration[8.1]
  def change
    create_table :memories do |t|
      t.string :agent_id
      t.string :memory_type
      t.text :content
      t.string :tags
      t.date :date
      t.jsonb :metadata

      t.timestamps
    end
  end
end

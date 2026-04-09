class CreateLinks < ActiveRecord::Migration[8.1]
  def change
    create_table :links do |t|
      t.references :project, null: false, foreign_key: true
      t.references :task, null: true, foreign_key: { on_delete: :nullify }
      t.string :url, null: false
      t.string :title
      t.string :source_type, null: false, default: "other"
      t.text :notes
      t.timestamps
    end

    add_index :links, :source_type
    add_index :links, :created_at
  end
end

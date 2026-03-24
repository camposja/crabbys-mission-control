class CreateOpsNotes < ActiveRecord::Migration[8.1]
  def change
    create_table :ops_notes do |t|
      t.string   :title, null: false
      t.string   :slug, null: false
      t.text     :body
      t.string   :category
      t.jsonb    :tags, default: []
      t.boolean  :pinned, default: false, null: false
      t.jsonb    :source_links, default: []
      t.datetime :last_used_at
      t.text     :command_snippet
      t.string   :notes_format, default: "markdown", null: false
      t.string   :status, default: "active", null: false
      t.timestamps
    end

    add_index :ops_notes, :slug, unique: true
    add_index :ops_notes, :category
    add_index :ops_notes, :pinned
    add_index :ops_notes, :status
  end
end

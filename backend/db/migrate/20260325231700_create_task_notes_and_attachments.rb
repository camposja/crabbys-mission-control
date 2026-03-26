class CreateTaskNotesAndAttachments < ActiveRecord::Migration[8.1]
  def change
    create_table :task_notes do |t|
      t.references :task, null: false, foreign_key: true
      t.string     :author, null: false  # "jose" or "crabby" or agent name
      t.text       :body, null: false
      t.timestamps
    end

    create_table :task_attachments do |t|
      t.references :task, null: false, foreign_key: true
      t.string     :filename, null: false
      t.text       :content, null: false
      t.string     :content_type, default: "text/plain"
      t.string     :uploaded_by
      t.timestamps
    end

    add_column :tasks, :approved_by, :string
    add_column :tasks, :approved_at, :datetime
  end
end

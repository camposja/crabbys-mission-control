class CreateTasks < ActiveRecord::Migration[8.1]
  def change
    create_table :tasks do |t|
      t.string  :title,       null: false
      t.text    :description
      t.string  :status,      null: false, default: "backlog"
      t.string  :priority,    default: "medium"
      t.string  :assignee
      t.integer :project_id
      t.integer :position,    default: 0
      t.datetime :due_date
      t.jsonb   :metadata,    default: {}

      t.timestamps
    end

    add_index :tasks, :status
    add_index :tasks, :project_id
    add_index :tasks, :position
  end
end

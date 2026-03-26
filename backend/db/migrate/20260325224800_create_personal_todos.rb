class CreatePersonalTodos < ActiveRecord::Migration[8.1]
  def change
    create_table :personal_todos do |t|
      t.string  :title, null: false
      t.boolean :done, default: false, null: false
      t.integer :position, default: 0
      t.timestamps
    end
  end
end

class CreateProjects < ActiveRecord::Migration[8.1]
  def change
    create_table :projects do |t|
      t.string :name,        null: false
      t.text   :description
      t.string :status,      default: "active"
      t.string :color,       default: "#f97316"

      t.timestamps
    end

    add_index :projects, :status
  end
end

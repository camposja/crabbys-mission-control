class AddTelegramThreadIdToProjects < ActiveRecord::Migration[8.1]
  def change
    add_column :projects, :telegram_thread_id, :integer
    add_column :projects, :telegram_thread_name, :string
  end
end

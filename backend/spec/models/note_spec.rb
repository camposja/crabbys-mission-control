require 'rails_helper'

RSpec.describe Note, type: :model do
  it { is_expected.to belong_to(:notable) }

  it { is_expected.to validate_presence_of(:body) }
  it { is_expected.to validate_inclusion_of(:note_type).in_array(Note::NOTE_TYPES) }

  describe "note_type distinction" do
    it "scopes course_material vs personal" do
      course = create(:course)
      material = create(:note, notable: course, note_type: "course_material")
      personal = create(:note, notable: course, note_type: "personal")

      expect(Note.course_material).to include(material)
      expect(Note.course_material).not_to include(personal)
      expect(Note.personal).to eq([personal])
    end
  end

  describe "polymorphic owners" do
    it "attaches to a course" do
      expect(create(:note, notable: create(:course))).to be_persisted
    end

    it "attaches to a course unit" do
      expect(create(:note, :for_unit)).to be_persisted
    end
  end

  describe "external_id uniqueness scoped per owner" do
    it "rejects a duplicate under the same owner" do
      course = create(:course)
      create(:note, notable: course, external_id: "intro")
      expect(build(:note, notable: course, external_id: "intro")).not_to be_valid
    end

    it "allows the same external_id under different owners" do
      create(:note, notable: create(:course), external_id: "intro")
      expect(build(:note, notable: create(:course_unit), external_id: "intro")).to be_valid
    end
  end
end

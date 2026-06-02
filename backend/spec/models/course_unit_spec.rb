require 'rails_helper'

RSpec.describe CourseUnit, type: :model do
  it { is_expected.to belong_to(:course) }
  it { is_expected.to have_many(:notes) }
  it { is_expected.to have_many(:links) }

  it { is_expected.to validate_presence_of(:title) }
  it { is_expected.to validate_inclusion_of(:unit_type).in_array(CourseUnit::UNIT_TYPES) }

  describe "position assignment" do
    it "auto-increments position within a course" do
      course = create(:course)
      first = create(:course_unit, course: course, position: nil)
      second = create(:course_unit, course: course, position: nil)
      expect(first.position).to eq(1)
      expect(second.position).to eq(2)
    end

    it "respects an explicit position" do
      unit = create(:course_unit, position: 5)
      expect(unit.position).to eq(5)
    end
  end

  describe "external_id uniqueness scoped per course" do
    it "rejects a duplicate within the same course" do
      course = create(:course)
      create(:course_unit, course: course, external_id: "intro")
      expect(build(:course_unit, course: course, external_id: "intro")).not_to be_valid
    end

    it "allows the same external_id under different courses" do
      create(:course_unit, course: create(:course), external_id: "intro")
      expect(build(:course_unit, course: create(:course), external_id: "intro")).to be_valid
    end
  end
end

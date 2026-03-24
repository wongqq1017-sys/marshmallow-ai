# encoding: utf-8
require "xcodeproj"

project_path = "ios/App/App.xcodeproj"
project = Xcodeproj::Project.open(project_path)

# Get the main target
target = project.targets.first
target.name = "棉花糖夥伴"

# Update PRODUCT_NAME in build configurations
target.build_configurations.each do |config|
  config.build_settings["PRODUCT_NAME"] = "棉花糖夥伴"
end

# Update the project name
project.root_object.name = "棉花糖夥伴"

project.save
puts "Done!"

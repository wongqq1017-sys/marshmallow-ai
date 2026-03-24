const xcodeproj = require('xcodeproj');

const projectPath = 'ios/App/App.xcodeproj';
const project = xcodeproj.open(projectPath);

// Get the main target
const target = project.targets[0];
target.name = '棉花糖夥伴';

// Update PRODUCT_NAME in build configurations
target.buildSettings('Debug'). PRODUCT_NAME = '棉花糖夥伴';
target.buildSettings('Release'). PRODUCT_NAME = '棉花糖夥伴';

// Update the project name  
project.rootObject.name = '棉花糖夥伴';

project.save();
console.log('Done!');

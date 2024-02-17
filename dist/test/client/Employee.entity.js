"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Employee = void 0;
const core_1 = require("@mikro-orm/core");
var Sex;
(function (Sex) {
    Sex["MAN"] = "man";
    Sex["WOMAN"] = "woman";
})(Sex || (Sex = {}));
let Employee = class Employee {
    id;
    first_name;
    last_name;
    age;
    sex;
    income;
};
exports.Employee = Employee;
__decorate([
    (0, core_1.PrimaryKey)()
], Employee.prototype, "id", void 0);
__decorate([
    (0, core_1.Property)()
], Employee.prototype, "first_name", void 0);
__decorate([
    (0, core_1.Property)()
], Employee.prototype, "last_name", void 0);
__decorate([
    (0, core_1.Property)()
], Employee.prototype, "age", void 0);
__decorate([
    (0, core_1.Enum)(() => Sex)
], Employee.prototype, "sex", void 0);
__decorate([
    (0, core_1.Property)()
], Employee.prototype, "income", void 0);
exports.Employee = Employee = __decorate([
    (0, core_1.Entity)()
], Employee);
//# sourceMappingURL=Employee.entity.js.map
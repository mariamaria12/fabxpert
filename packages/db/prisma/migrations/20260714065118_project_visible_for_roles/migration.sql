-- CreateTable
CREATE TABLE "_EmployeeRoleToProject" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_EmployeeRoleToProject_AB_unique" ON "_EmployeeRoleToProject"("A", "B");

-- CreateIndex
CREATE INDEX "_EmployeeRoleToProject_B_index" ON "_EmployeeRoleToProject"("B");

-- AddForeignKey
ALTER TABLE "_EmployeeRoleToProject" ADD CONSTRAINT "_EmployeeRoleToProject_A_fkey" FOREIGN KEY ("A") REFERENCES "employee_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmployeeRoleToProject" ADD CONSTRAINT "_EmployeeRoleToProject_B_fkey" FOREIGN KEY ("B") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

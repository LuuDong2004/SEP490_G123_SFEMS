package com.g123.sfems.module.school.student;

import com.g123.sfems.domain.school.student.Student;
import com.g123.sfems.module.catalog.base.CatalogController;
import com.g123.sfems.module.security.rowlevel.service.RowLevelSecurity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code /api/students} — mã quyền {@code students:*}, chỉ mở ở cổng trường ({@code PortalRoutes}). */
@RestController
@RequestMapping("/api/students")
public class StudentController extends CatalogController<Student, StudentRequest, StudentPatchRequest> {

    public StudentController(StudentService service, RowLevelSecurity rowLevel) {
        super(service, rowLevel);
    }

    @Override
    protected String resource() {
        return "students";
    }

    @Override
    protected Object respond(Student item, RowLevelSecurity rowLevel) {
        return StudentResponse.from(item, rowLevel);
    }
}

package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

/** Phạm vi dòng của phòng: seed ở changelog 010 (trường thấy phòng của mình, Sở thấy mọi trường). */
@Component
public class RoomPolicies extends SchoolOwnedPolicies<Room> {

    @Override
    public String resource() {
        return "rooms";
    }

    @Override
    public Class<Room> entityClass() {
        return Room.class;
    }
}

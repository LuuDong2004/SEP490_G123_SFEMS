package com.g123.sfems.module.school.facility;

import com.g123.sfems.domain.school.facility.Room;
import com.g123.sfems.module.school.base.SchoolOwnedPolicies;
import org.springframework.stereotype.Component;

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

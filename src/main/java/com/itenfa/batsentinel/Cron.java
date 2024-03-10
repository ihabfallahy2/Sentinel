package com.itenfa.batsentinel;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class Cron {

    @Scheduled(cron= "*/10 * * * * *")
    public void scheduler(){
        long time = System.currentTimeMillis() / 1000;

        log.info("current time is: " + time);
    }
}

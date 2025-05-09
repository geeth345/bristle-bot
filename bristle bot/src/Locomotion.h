#pragma once

namespace Locomotion
{
    //initializes motor control and Lévy walk parameters such as interval times 
    void initialiseLocomotion();

    //updates Lévy walk behavior (on loop)
    void updateLocomotion();

    //locomotion control functions
    void levyWalk();
    void moveForward();
    void turnLeft();
    void turnRight();
    void stopMotors();
    void resumeMotors();

}


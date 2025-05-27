#pragma once

namespace Locomotion
{
    //initializes motor control and Lévy walk parameters such as interval times 
    void initialiseLocomotion();

    //updates Lévy walk behavior (on loop)
    void updateLocomotion();

    // alternate walking behaviour
    void updateLocomotionWalkStraight();

    //locomotion control functions
    void walkStraight(float currentHeading);
    void levyWalk();
    void moveForward();
    void turnLeft();
    void turnRight();
    void stopMotors();
    void resumeMotors();

}


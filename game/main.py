import asyncio
import sys
import pathlib
import random
import pygame
from leaderboard import Leaderboard

IN_BROWSER = sys.platform == "emscripten"
SCORE_KEY = "eddiekong.snake.top_score"
PATH = pathlib.Path("top_score.txt")


def load_top_score():
    try:
        if IN_BROWSER:
            import platform
            value = platform.window.localStorage.getItem(SCORE_KEY)
            return max(0, int(str(value))) if value else 0
        return max(0, int(PATH.read_text()))
    except Exception as exc:
        # Missing/corrupt saves or blocked browser storage must not stop play.
        print("Top score unavailable:", exc)
        return 0


def save_top_score(score):
    try:
        if IN_BROWSER:
            import platform
            platform.window.localStorage.setItem(SCORE_KEY, str(score))
        else:
            PATH.write_text(str(score))
    except Exception as exc:
        print("Top score could not be saved:", exc)


async def main():
    pygame.init()
    leaderboard = Leaderboard()

    top_score = load_top_score()

    COL = 50
    ROW = 25 
    CELL = 20
    WIDTH = COL*CELL
    HEIGHT = ROW*CELL
    screen = pygame.display.set_mode((WIDTH,HEIGHT))
    next_tick = 0
    answer = 1
    rank_started = False
    rank_reported = False
    rank_difficulty = 1
    rank_rate = 1
    rank_eligible = True
    difficulty_by_rate = {1: 1, 3: 2, 5: 3, 8: 4, 10: 5, 12: 6, 15: 7, 22: 8, 30: 9}
    sp_x = COL//2
    sp_y = ROW//2
    apple = (random.randint(0,COL-1), random.randint(0,ROW-1))
    snake = []
    gold_apple = (random.randint(0,COL-1), random.randint(0,ROW-1))
    green_apple = (random.randint(0,COL-1), random.randint(0,ROW-1))
    dx = 1
    dy = 0
    snake.append((sp_x,sp_y))

    running = True
    game_over = False
    game_start = False
    game_pause = False
    gold_apple_exist = False
    green_apple_exist = False
    points = 0
    time = 0
    time2 = 0
    time3 = 0
    time4 = 0
    time5 = 0
    lives = 1


    font1 = pygame.font.SysFont(None,230)
    text1 = font1.render('GAME OVER',True,'dark red')
    text1_rect = text1.get_rect()
    text1_rect.center = screen.get_rect().center

    font2 = pygame.font.SysFont(None,40)

    text3 = font2.render("Choose a difficulty",True,'black')
    text3_rect = text3.get_rect()
    text3_rect.top = screen.get_rect().top

    font3 = pygame.font.SysFont(None,28)
    text4 = font3.render("baby=1, kiddie=2, supereasy=3, easy=4, medium=5, hard=6, superhard=7, insane=8 or impossible=9",True,'black')
    text4_rect = text4.get_rect()
    text4_rect.center = screen.get_rect().center

    text5 = font2.render("Press 'r' to try again",True,'dark red')
    text5_rect = text5.get_rect()
    text5_rect.bottom = screen.get_rect().bottom

    text6 = font2.render("GAME PAUSED",True,'black')
    text6_rect = text6.get_rect()
    text6_rect.center = screen.get_rect().center

    font4 = pygame.font.SysFont(None,25)


    while running:
        # Yield on EVERY path, including the original continue statements.
        await asyncio.sleep(0)
        # Report before reading restart keys, exactly once on either game-over path.
        if game_over and rank_started and not rank_reported:
            rank_reported = True
            leaderboard.finish(points, rank_difficulty, time, rank_eligible)
        if pygame.time.get_ticks() < next_tick:
            continue
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_UP or event.key == pygame.K_w:
                    dx = 0
                    dy = -1
                if event.key == pygame.K_DOWN or event.key == pygame.K_s:
                    dx = 0
                    dy = 1
                if event.key == pygame.K_LEFT or event.key == pygame.K_a:
                    dx = -1
                    dy = 0
                if event.key == pygame.K_RIGHT or event.key == pygame.K_d:
                    dx = 1
                    dy = 0
                
                if event.key == pygame.K_r:
                    rank_started = False
                    rank_reported = False
                    rank_eligible = True
                    time2 = time3 = time4 = time5 = 0
                    game_over = False
                    game_start = False
                    game_pause = False
                    lives = 1
                    apple = (random.randint(0,COL-1), random.randint(0,ROW-1))
                    snake = []
                    dx = 1
                    dy = 0
                    snake.append((sp_x,sp_y))
                    points = 0
                    time = 0
                    gold_apple_exist = False
                    green_apple_exist = False
                    top_score = max(top_score, load_top_score())

                if event.key == pygame.K_1:
                    answer = 1
                    game_start = True
                if event.key == pygame.K_2:
                    answer = 3
                    game_start = True
                if event.key == pygame.K_3:
                    answer = 5
                    game_start = True
                if event.key == pygame.K_4:
                    answer = 8
                    game_start = True
                if event.key == pygame.K_5:
                    answer = 10
                    game_start = True
                if event.key == pygame.K_6:
                    answer = 12
                    game_start = True
                if event.key == pygame.K_7:
                    answer = 15
                    game_start = True
                if event.key == pygame. K_8:
                    answer = 22                                                                
                    game_start = True
                if event.key == pygame.K_9:
                    answer = 30
                    game_start = True
                if game_start == True and event.key == pygame.K_SPACE:
                    if game_pause == True:
                        game_pause = False
                    else:
                        game_pause = True


        if game_start and not rank_started:
            rank_started = True
            rank_rate = answer
            rank_difficulty = difficulty_by_rate[answer]
            leaderboard.start(rank_difficulty)
        elif rank_started and answer != rank_rate:
            # Original mid-game difficulty controls remain usable, but do not rank.
            rank_eligible = False

        if game_start == False:
            screen.fill('white')
            screen.blit(text3, text3_rect)  
            screen.blit(text4, text4_rect)  
        else:
            if game_over == False:
                if game_pause == False:
                    new_head_x = snake[0][0] + dx
                    new_head_y = snake[0][1] + dy
                    if new_head_x == -1 or new_head_y== -1 or new_head_x == COL or new_head_y == ROW or (new_head_x, new_head_y) in snake:   
                        lives = lives - 1 
                        if new_head_x == -1: new_head_x = COL-1
                        if new_head_x == COL: new_head_x = 0
                        if new_head_y == -1: new_head_y = ROW-1
                        if new_head_y == ROW: new_head_y = 0
                        print("YOU LOST, FALIURE. GAME OVER!!!!!!!!!!!")
                    if lives == 0:
                        game_over = True
                        continue

                    if points == 10 or points == 20 or points == 30 or points == 40 or points == 50 or points == 60 or points == 70 or points == 80 or points == 90 or points == 100:
                        game_pause = True

                    snake.insert(0,(new_head_x, new_head_y))
                    if apple == snake[0]:
                        apple = (random.randint(0,COL-1), random.randint(0,ROW-1)) 
                        points = points + 1   
                    elif gold_apple == snake[0] and gold_apple_exist == True:
                        points = points + 5 
                        gold_apple_exist = False
                    elif green_apple == snake[0] and green_apple_exist == True:
                        lives = lives + 1 
                        green_apple_exist = False
                    else:
                        snake.pop()

                    if gold_apple_exist == False and random.randint(1, 100)== 1:
                        gold_apple = (random.randint(0,COL-1), random.randint(0,ROW-1))
                        gold_apple_exist = True
                        time3 = 0
                    if time3 >= 3:
                        gold_apple_exist = False 

                    if green_apple_exist == False and random.randint(1, 300)== 1:
                        green_apple = (random.randint(0,COL-1), random.randint(0,ROW-1))
                        green_apple_exist = True
                        time4 = 0

                    if time4 >= 3:
                        green_apple_exist = False
                        

                    screen.fill('white')
                    # for i in range(COL):
                    #     pygame.draw.line(screen,'black',(i*CELL,0), (i*CELL,HEIGHT))
                    # for i in range(ROW):
                    #     pygame.draw.line(screen, 'black', (0, i*CELL), (WIDTH, i*CELL))
                    
                    pygame.draw.rect(screen,'red',pygame.Rect(apple[0]*CELL,apple[1]*CELL,CELL,CELL))
                    pygame.draw.rect(screen,'brown', pygame.Rect((apple[0]+0.5)*CELL,(apple[1]-0.4)*CELL,CELL/10, CELL/2.5))
                    pygame.draw.rect(screen,'green', pygame.Rect((apple[0]+0.65)*CELL,(apple[1]-0.25)*CELL, CELL/3, CELL/5))

                    for i in range(len(snake)):
                        pygame.draw.rect(screen,'dark green',pygame.Rect(snake[i][0]*CELL,snake[i][1]*CELL,CELL,CELL))
                    text8 = font3.render(f"points:{points}   lives: {lives}   top score: {top_score}",True,'blue')
                    text8_rect = text8.get_rect()
                    text8_rect.topleft = screen.get_rect().topleft
                    screen.blit(text8, text8_rect)

                    if dx == 0 and dy == -1:
                        pygame.draw.rect(screen,'red',pygame.Rect((snake[0][0]+ 0.5)*CELL,(snake[0][1]-0.5)*CELL,CELL/6,CELL/2))
                        pygame.draw.circle(screen, 'black', ((snake[0][0]+0.25)*CELL,(snake[0][1]+0.25)*CELL), CELL/10)
                        pygame.draw.circle(screen, 'black', ((snake[0][0]+0.75)*CELL,(snake[0][1]+0.25)*CELL), CELL/10)
                    if dx == 0 and dy == 1:
                        pygame.draw.rect(screen,'red',pygame.Rect((snake[0][0]+ 0.5)*CELL,(snake[0][1]+1)*CELL,CELL/6,CELL/2))
                        pygame.draw.circle(screen, 'black', ((snake[0][0]+0.25)*CELL,(snake[0][1]+0.75)*CELL), CELL/10)
                        pygame.draw.circle(screen, 'black', ((snake[0][0]+0.75)*CELL,(snake[0][1]+0.75)*CELL), CELL/10)
                    if dx == -1 and dy == 0:
                        pygame.draw.rect(screen,'red',pygame.Rect((snake[0][0]-0.5)*CELL,(snake[0][1]+ 0.5)*CELL,CELL/2,CELL/6))
                        pygame.draw.circle(screen, 'black', ((snake[0][0]+0.25)*CELL,(snake[0][1]+0.25)*CELL), CELL/10)
                        pygame.draw.circle(screen, 'black', ((snake[0][0]+0.25)*CELL,(snake[0][1]+0.75)*CELL), CELL/10)
                    if dx == 1 and dy == 0:
                        pygame.draw.rect(screen,'red',pygame.Rect((snake[0][0]+1)*CELL,(snake[0][1]+ 0.5)*CELL,CELL/2,CELL/6))
                        pygame.draw.circle(screen, 'black', ((snake[0][0]+0.75)*CELL,(snake[0][1]+0.25)*CELL), CELL/10)
                        pygame.draw.circle(screen, 'black', ((snake[0][0]+0.75)*CELL,(snake[0][1]+0.75)*CELL), CELL/10)
                    if gold_apple_exist == True:
                        pygame.draw.rect(screen,'gold',pygame.Rect(gold_apple[0]*CELL,gold_apple[1]*CELL,CELL,CELL))
                        pygame.draw.rect(screen,'brown', pygame.Rect((gold_apple[0]+0.5)*CELL,(gold_apple[1]-0.4)*CELL,CELL/10, CELL/2.5))
                        pygame.draw.rect(screen,'green', pygame.Rect((gold_apple[0]+0.65)*CELL,(gold_apple[1]-0.25)*CELL, CELL/3, CELL/5))
                        time3 = time3 + 1/answer

                    if green_apple_exist == True:
                        pygame.draw.rect(screen,'green',pygame.Rect(green_apple[0]*CELL,green_apple[1]*CELL,CELL,CELL))
                        pygame.draw.rect(screen,'brown', pygame.Rect((green_apple[0]+0.5)*CELL,(green_apple[1]-0.4)*CELL,CELL/10, CELL/2.5))
                        pygame.draw.rect(screen,'green', pygame.Rect((green_apple[0]+0.65)*CELL,(green_apple[1]-0.25)*CELL, CELL/3, CELL/5))
                        time4 = time4 + 1/answer

                else:
                    
                    if points == 10 or points == 20 or points == 30 or points == 40 or points == 50 or points == 60 or points == 70 or points == 80 or points == 90:
                        screen.fill('white')
                        text7 = font4.render(f"Well done. Keep going. You've already earned {points} points. I'll give you one more point as a reward. Get ready!",True,'black')
                        text7_rect = text7.get_rect()
                        text7_rect.center = screen.get_rect().center
                        screen.blit(text7, text7_rect)
                        time2 = time2 + 1/answer
                    else:
                        screen.fill('white')
                        screen.blit(text6, text6_rect)

                    if points == 100:
                        screen.fill('white')
                        text9 = font4.render("Well done! You are officially a snake champion.",True,'black')
                        text9_rect = text9.get_rect()
                        text9_rect.center = screen.get_rect().center
                        screen.blit(text9, text9_rect)
                        time5 = time5 + 1/answer

                    
                    if time2 >= 5:
                        points = points + 1
                        game_pause = False
                        time2 = 0
                    if time5 >=5 :
                        game_over = True
                        continue


                time = time + 1/answer

            else:
                text2 = font2.render(f"You earned {points} points in {time:.2f} seconds!",True,'white')
                text2_rect = text2.get_rect()
                text2_rect.center = screen.get_rect().center
                text2_rect.centery = text2_rect.centery + 100
                screen.fill('black')
                screen.blit(text1,text1_rect)
                screen.blit(text2,text2_rect)
                screen.blit(text5, text5_rect)
                if top_score < points:
                    save_top_score(points)
                    top_score = points
            
        pygame.display.flip()
        # Same selected update rate, without blocking the browser with clock.tick().
        next_tick = pygame.time.get_ticks() + 1000 / answer


    pygame.quit()


asyncio.run(main())
